/**
 * Unit tests for DataAggregator.
 *
 * Tests:
 *  - All providers succeed
 *  - Weather provider fails — satellite and soil still returned
 *  - All providers fail — graceful null context
 *  - Cache hit prevents provider call
 *  - Freshness classification correct
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WeatherObservation, SatelliteObservation } from '@brics-agrin/shared';

// ── Mocks must be declared before module imports ──────────────────────────────
vi.mock('../../../src/providers/registry.js', () => ({
  providerRegistry: {
    getWeatherProvider: vi.fn(),
    getSatelliteProvider: vi.fn(),
    getSoilProvider: vi.fn(),
  },
}));

vi.mock('../../../src/cache/client.js', () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
  CacheKeys: {
    weather: (lat: number, lon: number) => `weather:${lat}:${lon}`,
    satellite: (lat: number, lon: number) => `satellite:${lat}:${lon}`,
    soil: (fieldId: string) => `soil:${fieldId}`,
  },
}));

import { DataAggregator } from '../../../src/providers/DataAggregator.js';
import { providerRegistry } from '../../../src/providers/registry.js';
import { cacheGet, cacheSet } from '../../../src/cache/client.js';

const LOCATION = { lat: 28.6139, lon: 77.2090 };

const mockWeather: WeatherObservation = {
  location: LOCATION,
  timestamp: new Date().toISOString(),
  temperatureCelsius: 30,
  humidityPercent: 65,
  precipitationMm: 2,
  windSpeedMps: 3,
  dataType: 'observed',
  source: 'test',
  freshness: 'current',
};

const mockSatellite: SatelliteObservation = {
  location: LOCATION,
  timestamp: new Date().toISOString(),
  ndvi: 0.65,
  source: 'test',
  dataType: 'model_derived',
  freshness: 'recent',
};

describe('DataAggregator', () => {
  let aggregator: DataAggregator;
  let mockWeatherProvider: { getCurrentWeather: ReturnType<typeof vi.fn>; isHealthy: ReturnType<typeof vi.fn> };
  let mockSatelliteProvider: { getLatestObservation: ReturnType<typeof vi.fn>; isHealthy: ReturnType<typeof vi.fn> };
  let mockSoilProvider: { getLatestObservation: ReturnType<typeof vi.fn>; isHealthy: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();

    mockWeatherProvider = {
      getCurrentWeather: vi.fn().mockResolvedValue(mockWeather),
      isHealthy: vi.fn().mockResolvedValue(true),
    };
    mockSatelliteProvider = {
      getLatestObservation: vi.fn().mockResolvedValue(mockSatellite),
      isHealthy: vi.fn().mockResolvedValue(true),
    };
    mockSoilProvider = {
      getLatestObservation: vi.fn().mockResolvedValue(null),
      isHealthy: vi.fn().mockResolvedValue(true),
    };

    vi.mocked(providerRegistry.getWeatherProvider).mockReturnValue(mockWeatherProvider as never);
    vi.mocked(providerRegistry.getSatelliteProvider).mockReturnValue(mockSatelliteProvider as never);
    vi.mocked(providerRegistry.getSoilProvider).mockReturnValue(mockSoilProvider as never);
    vi.mocked(cacheGet).mockResolvedValue(null);

    aggregator = new DataAggregator();
  });

  it('returns data from all providers when all succeed', async () => {
    const result = await aggregator.aggregate({
      location: LOCATION,
      country: 'IN',
      fieldId: 'field-123',
    });

    expect(result.weather).toEqual(mockWeather);
    expect(result.satellite).toEqual(mockSatellite);
    expect(result.soil).toBeNull();
    expect(result.weatherFreshness).toBe('current');
  });

  it('returns null weather but still returns satellite when weather provider fails', async () => {
    mockWeatherProvider.getCurrentWeather.mockRejectedValue(
      new Error('Weather API down'),
    );

    const result = await aggregator.aggregate({
      location: LOCATION,
      country: 'IN',
    });

    expect(result.weather).toBeNull();
    expect(result.weatherFreshness).toBe('expired');
    expect(result.satellite).toEqual(mockSatellite);
  });

  it('returns null context when all providers fail', async () => {
    mockWeatherProvider.getCurrentWeather.mockRejectedValue(new Error('down'));
    mockSatelliteProvider.getLatestObservation.mockRejectedValue(new Error('down'));
    mockSoilProvider.getLatestObservation.mockRejectedValue(new Error('down'));

    const result = await aggregator.aggregate({
      location: LOCATION,
      country: 'IN',
      fieldId: 'field-123',
    });

    expect(result.weather).toBeNull();
    expect(result.satellite).toBeNull();
    expect(result.soil).toBeNull();
    expect(result.weatherFreshness).toBe('expired');
    expect(result.satelliteFreshness).toBe('expired');
    expect(result.soilFreshness).toBe('expired');
  });

  it('uses cached weather and skips provider call on cache hit', async () => {
    vi.mocked(cacheGet).mockImplementation(async (key: string) => {
      if (key.startsWith('weather:')) return mockWeather as never;
      return null;
    });

    const result = await aggregator.aggregate({
      location: LOCATION,
      country: 'IN',
    });

    expect(result.weather).toEqual(mockWeather);
    // Provider should NOT have been called since cache hit
    expect(mockWeatherProvider.getCurrentWeather).not.toHaveBeenCalled();
  });

  it('writes provider result to cache after successful fetch', async () => {
    await aggregator.aggregate({ location: LOCATION, country: 'IN' });

    expect(cacheSet).toHaveBeenCalledWith(
      expect.stringContaining('weather:'),
      mockWeather,
      expect.any(Number),
    );
  });

  it('does not query soil provider when fieldId is not provided', async () => {
    await aggregator.aggregate({ location: LOCATION, country: 'IN' });

    expect(mockSoilProvider.getLatestObservation).not.toHaveBeenCalled();
    expect(result => result).toBeTruthy();
  });
});
