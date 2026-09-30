/**
 * Agricultural Data Aggregator.
 *
 * Coordinates parallel fetching from all three provider types
 * (weather, satellite, soil) for a given farm context.
 *
 * Responsibilities:
 *   - Check cache before hitting external APIs
 *   - Fire all provider requests in parallel (Promise.allSettled)
 *   - Never let one provider failure block others
 *   - Write results to cache
 *   - Return a fully-typed, freshness-tagged AgriculturalDataContext
 *   - Log every staleness/unavailability clearly
 *
 * The advisory engine receives this context and makes decisions;
 * it does NOT know or care how the data was fetched.
 */

import type { AgriculturalDataContext } from '../domain/advisory/types.js';
import type { GeoPoint, WeatherObservation, SatelliteObservation, SoilObservation } from '@brics-agrin/shared';
import { cacheGet, cacheSet, CacheKeys } from '../cache/client.js';
import { config } from '../config/index.js';
import { classifyFreshness } from '../utils/dataFreshness.js';
import { createLogger } from '../observability/logger.js';
import { providerRegistry } from './registry.js';

const log = createLogger('data-aggregator');

export interface AggregationInput {
  location: GeoPoint;
  fieldId?: string;
  country: string;
}

export class DataAggregator {
  /**
   * Fetch weather, satellite, and soil data in parallel.
   * Fails gracefully: if any provider is down, that slot is null.
   * Cache results to reduce external API calls.
   */
  async aggregate(input: AggregationInput): Promise<AgriculturalDataContext> {
    const { location, fieldId, country } = input;

    const weatherProvider = providerRegistry.getWeatherProvider(country);
    const satelliteProvider = providerRegistry.getSatelliteProvider(country);
    const soilProvider = providerRegistry.getSoilProvider(country);

    // ── Parallel cache lookups ────────────────────────────────────────────────
    const weatherCacheKey = CacheKeys.weather(location.lat, location.lon);
    const satelliteCacheKey = CacheKeys.satellite(location.lat, location.lon);
    const soilCacheKey = fieldId ? CacheKeys.soil(fieldId) : null;

    const [cachedWeather, cachedSatellite, cachedSoil] = await Promise.all([
      cacheGet<WeatherObservation>(weatherCacheKey),
      cacheGet<SatelliteObservation>(satelliteCacheKey),
      soilCacheKey ? cacheGet<SoilObservation>(soilCacheKey) : Promise.resolve(null),
    ]);

    // ── Parallel provider fetches (only for cache misses) ─────────────────────
    const [weatherResult, satelliteResult, soilResult] = await Promise.allSettled([
      cachedWeather
        ? Promise.resolve(cachedWeather)
        : weatherProvider.getCurrentWeather(location),
      cachedSatellite
        ? Promise.resolve(cachedSatellite)
        : satelliteProvider.getLatestObservation(location),
      cachedSoil !== null
        ? Promise.resolve(cachedSoil)
        : fieldId
          ? soilProvider.getLatestObservation(fieldId)
          : Promise.resolve(null),
    ]);

    // ── Extract values safely ─────────────────────────────────────────────────
    const weather = this.extractSettled<WeatherObservation>(
      weatherResult, 'weather', location,
    );
    const satellite = this.extractSettled<SatelliteObservation>(
      satelliteResult, 'satellite', location,
    );
    const soil = this.extractSettled<SoilObservation>(
      soilResult, 'soil', location,
    );

    // ── Cache successful results ──────────────────────────────────────────────
    if (weather && !cachedWeather) {
      await cacheSet(weatherCacheKey, weather, config.WEATHER_CACHE_TTL_SECONDS);
    }
    if (satellite && !cachedSatellite) {
      await cacheSet(satelliteCacheKey, satellite, config.SATELLITE_CACHE_TTL_SECONDS);
    }
    if (soil && soilCacheKey && cachedSoil === null) {
      await cacheSet(soilCacheKey, soil, config.ADVISORY_CACHE_TTL_SECONDS);
    }

    // ── Log data availability for observability ───────────────────────────────
    log.info(
      {
        location,
        country,
        fieldId,
        weatherAvailable: !!weather,
        satelliteAvailable: !!satellite,
        soilAvailable: !!soil,
        weatherCacheHit: !!cachedWeather,
        satelliteCacheHit: !!cachedSatellite,
      },
      'Data aggregation complete',
    );

    return {
      weather,
      satellite,
      soil,
      weatherFreshness: weather
        ? classifyFreshness(weather.timestamp)
        : 'expired',
      soilFreshness: soil
        ? classifyFreshness(soil.observedAt)
        : 'expired',
      satelliteFreshness: satellite
        ? classifyFreshness(satellite.timestamp)
        : 'expired',
    };
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private extractSettled<T>(
    result: PromiseSettledResult<T | null>,
    name: string,
    location: GeoPoint,
  ): T | null {
    if (result.status === 'rejected') {
      log.warn(
        { error: result.reason, dataType: name, location },
        `${name} provider failed — continuing without ${name} data`,
      );
      return null;
    }
    return result.value;
  }
}

export const dataAggregator = new DataAggregator();
