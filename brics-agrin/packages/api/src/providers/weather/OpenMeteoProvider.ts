/**
 * Weather Provider: Open-Meteo
 *
 * Open-Meteo is a free, open-source weather API — no API key required
 * for basic use. This makes it an excellent default for a Digital Public Good.
 *
 * Docs: https://open-meteo.com/en/docs
 *
 * Data transparency:
 *  - Current conditions are labeled 'observed'
 *  - Forecast data is labeled 'predicted'
 *  - All responses include timestamp and source
 */

import type { WeatherProvider } from '../interfaces.js';
import type { GeoPoint, WeatherObservation } from '@brics-agrin/shared';
import { httpGet } from '../../utils/httpClient.js';
import { createLogger } from '../../observability/logger.js';
import { classifyFreshness } from '../../utils/dataFreshness.js';
import { metrics } from '../../observability/metrics.js';
import { config } from '../../config/index.js';

const log = createLogger('weather:open-meteo');

// ─── Open-Meteo API shape ─────────────────────────────────────────────────────

interface OpenMeteoCurrentResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    precipitation: number;
    wind_speed_10m: number;
    uv_index?: number;
    weather_code: number;
  };
}

export class OpenMeteoWeatherProvider implements WeatherProvider {
  readonly providerKey = 'open-meteo';
  readonly displayName = 'Open-Meteo';

  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = config.OPENMETEO_BASE_URL;
  }

  async getCurrentWeather(location: GeoPoint): Promise<WeatherObservation | null> {
    const start = Date.now();
    try {
      const data = await httpGet<OpenMeteoCurrentResponse>(
        this.providerKey,
        `${this.baseUrl}/v1/forecast`,
        {
          latitude: location.lat,
          longitude: location.lon,
          current: [
            'temperature_2m',
            'relative_humidity_2m',
            'precipitation',
            'wind_speed_10m',
            'uv_index',
            'weather_code',
          ].join(','),
          timezone: 'auto',
          forecast_days: 1,
        },
      );

      const latencyMs = Date.now() - start;
      metrics.weatherProviderLatency.observe(latencyMs);

      const currentTime = new Date(data.current.time);

      const observation: WeatherObservation = {
        location,
        timestamp: currentTime.toISOString(),
        temperatureCelsius: data.current.temperature_2m,
        humidityPercent: data.current.relative_humidity_2m,
        precipitationMm: data.current.precipitation,
        windSpeedMps: data.current.wind_speed_10m / 3.6, // km/h → m/s
        uvIndex: data.current.uv_index,
        dataType: 'observed',
        source: this.displayName,
        freshness: classifyFreshness(currentTime),
      };

      log.debug({ location, latencyMs }, 'Weather fetched successfully');
      return observation;
    } catch (err) {
      metrics.externalProviderError.increment({ provider: this.providerKey });
      log.warn({ err, location }, 'Open-Meteo fetch failed — returning null');
      return null;
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      await httpGet(
        this.providerKey,
        `${this.baseUrl}/v1/forecast`,
        { latitude: 28.6, longitude: 77.2, current: 'temperature_2m', forecast_days: 1 },
      );
      return true;
    } catch {
      return false;
    }
  }
}
