/**
 * Provider interface contracts.
 *
 * All external data providers MUST implement these interfaces.
 * The advisory engine depends on interfaces — never on concrete providers.
 * This enables:
 *   - Swapping providers per country without touching business logic
 *   - Testing with stub providers
 *   - Graceful degradation when one provider fails
 *   - Adding new BRICS-country providers as adapters
 */

import type {
  WeatherObservation,
  SatelliteObservation,
  SoilObservation,
  GeoPoint,
} from '@brics-agrin/shared';

// ─── Weather Provider ─────────────────────────────────────────────────────────

export interface WeatherProvider {
  readonly providerKey: string;
  readonly displayName: string;

  /**
   * Fetch current weather + short-term forecast for a location.
   * Returns null (and logs) if the provider is unavailable — never throws.
   */
  getCurrentWeather(location: GeoPoint): Promise<WeatherObservation | null>;

  /**
   * Check if the provider is reachable.
   */
  isHealthy(): Promise<boolean>;
}

// ─── Satellite Provider ───────────────────────────────────────────────────────

export interface SatelliteProvider {
  readonly providerKey: string;
  readonly displayName: string;

  /**
   * Fetch latest available satellite observation for a location.
   * Returns null if no recent data is available.
   */
  getLatestObservation(location: GeoPoint): Promise<SatelliteObservation | null>;

  isHealthy(): Promise<boolean>;
}

// ─── Soil Provider ────────────────────────────────────────────────────────────

export interface SoilDataProvider {
  readonly providerKey: string;
  readonly displayName: string;

  /**
   * Fetch latest soil observation for a specific field.
   * Returns null if no data is available for that field.
   */
  getLatestObservation(fieldId: string): Promise<SoilObservation | null>;

  isHealthy(): Promise<boolean>;
}

// ─── Provider Registry ────────────────────────────────────────────────────────

/**
 * Registry that resolves the correct provider for a given country.
 * Countries register their providers at startup via configuration.
 */
export interface ProviderRegistry {
  getWeatherProvider(country: string): WeatherProvider;
  getSatelliteProvider(country: string): SatelliteProvider;
  getSoilProvider(country: string): SoilDataProvider;
}
