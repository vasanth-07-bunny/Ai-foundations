/**
 * Stub weather provider — used in tests and as a fallback in
 * environments where no real provider is available.
 *
 * Returns deterministic data derived from the input location so
 * tests are reproducible without hitting any external API.
 * Data is clearly labeled as 'historical' to prevent confusion.
 */

import type { WeatherProvider } from '../interfaces.js';
import type { GeoPoint, WeatherObservation } from '@brics-agrin/shared';

export class StubWeatherProvider implements WeatherProvider {
  readonly providerKey = 'stub-weather';
  readonly displayName = 'Stub Weather Provider (Test/Fallback)';

  async getCurrentWeather(location: GeoPoint): Promise<WeatherObservation> {
    // Deterministic, location-seeded values for reproducible tests
    const seed = Math.abs(location.lat + location.lon);
    return {
      location,
      timestamp: new Date().toISOString(),
      temperatureCelsius: 20 + (seed % 15),
      humidityPercent: 50 + (seed % 40),
      precipitationMm: seed % 10,
      windSpeedMps: 1 + (seed % 8),
      uvIndex: 4 + (seed % 6),
      dataType: 'historical',  // Clearly labeled — not real data
      source: this.displayName,
      freshness: 'current',
    };
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }
}
