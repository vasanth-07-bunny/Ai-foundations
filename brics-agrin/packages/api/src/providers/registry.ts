/**
 * Provider Registry — resolves the correct provider for each country.
 *
 * Country-specific configuration is data, not code. Adding a new BRICS
 * country requires registering its adapters here, not changing business logic.
 *
 * Priority order within a country:
 *   1. Country-specific provider (e.g. IMD for India)
 *   2. Regional provider (e.g. Open-Meteo for all countries)
 *   3. Stub (test/fallback only — clearly labeled)
 *
 * The advisory engine and all services depend on this registry
 * interface, never on concrete provider classes.
 */

import type {
  WeatherProvider,
  SatelliteProvider,
  SoilDataProvider,
  ProviderRegistry,
} from './interfaces.js';
import { OpenMeteoWeatherProvider } from './weather/OpenMeteoProvider.js';
import { StubWeatherProvider } from './weather/StubWeatherProvider.js';
import { StubSatelliteProvider } from './satellite/StubSatelliteProvider.js';
import { RemoteSatelliteProvider } from './satellite/RemoteSatelliteProvider.js';
import { DatabaseSoilProvider } from './soil/DatabaseSoilProvider.js';
import { config } from '../config/index.js';
import { createLogger } from '../observability/logger.js';

const log = createLogger('provider-registry');

// ─── Cached singleton instances ───────────────────────────────────────────────
// Providers are stateless — one instance per type is sufficient

const openMeteoProvider = new OpenMeteoWeatherProvider();
const stubWeatherProvider = new StubWeatherProvider();
const remoteSatelliteProvider = new RemoteSatelliteProvider();
const stubSatelliteProvider = new StubSatelliteProvider();
const databaseSoilProvider = new DatabaseSoilProvider();

/**
 * Default provider registry.
 *
 * Currently uses Open-Meteo for all countries (free, no key required),
 * and the remote satellite provider where configured.
 * Extend this with per-country providers as integrations are built.
 */
class DefaultProviderRegistry implements ProviderRegistry {
  getWeatherProvider(country: string): WeatherProvider {
    // Future: return country-specific provider for countries with
    // their own meteorological service APIs (IMD for IN, INMET for BR, etc.)
    log.debug({ country }, 'Resolving weather provider');

    if (config.IS_TEST) {
      return stubWeatherProvider;
    }

    return openMeteoProvider;
  }

  getSatelliteProvider(country: string): SatelliteProvider {
    log.debug({ country }, 'Resolving satellite provider');

    if (config.IS_TEST) {
      return stubSatelliteProvider;
    }

    // Use remote provider if configured, otherwise stub with clear label
    if (config.SATELLITE_BASE_URL && config.SATELLITE_API_KEY) {
      return remoteSatelliteProvider;
    }

    log.warn(
      { country },
      'No satellite provider configured — using stub. Set SATELLITE_BASE_URL and SATELLITE_API_KEY.',
    );
    return stubSatelliteProvider;
  }

  getSoilProvider(_country: string): SoilDataProvider {
    // Soil data is always sourced from our own database (populated via
    // government imports, IoT sensors, or manual entry)
    return databaseSoilProvider;
  }
}

export const providerRegistry: ProviderRegistry = new DefaultProviderRegistry();
