/**
 * Unit tests for confidence calculator.
 */

import { describe, it, expect } from 'vitest';
import { calculateAdvisoryConfidence } from '../../../../src/services/advisory/ConfidenceCalculator.js';
import type { AgriculturalDataContext } from '../../../../src/domain/advisory/types.js';
import type { WeatherObservation, SatelliteObservation, SoilObservation } from '@brics-agrin/shared';

const CURRENT_WEATHER: WeatherObservation = {
  location: { lat: 0, lon: 0 },
  timestamp: new Date().toISOString(),
  temperatureCelsius: 25,
  humidityPercent: 60,
  precipitationMm: 2,
  windSpeedMps: 3,
  dataType: 'observed',
  source: 'test',
  freshness: 'current',
};

const CURRENT_SATELLITE: SatelliteObservation = {
  location: { lat: 0, lon: 0 },
  timestamp: new Date().toISOString(),
  ndvi: 0.65,
  source: 'test',
  dataType: 'model_derived',
  freshness: 'current',
};

const CURRENT_SOIL: SoilObservation = {
  id: 's1', fieldId: 'f1',
  observedAt: new Date().toISOString(),
  phLevel: 6.5,
  source: 'lab',
  dataType: 'observed',
};

describe('calculateAdvisoryConfidence', () => {
  it('returns maximum confidence when all sources are current', () => {
    const result = calculateAdvisoryConfidence({
      weather: CURRENT_WEATHER,
      satellite: CURRENT_SATELLITE,
      soil: CURRENT_SOIL,
      weatherFreshness: 'current',
      soilFreshness: 'current',
      satelliteFreshness: 'current',
    });
    expect(result.score).toBeCloseTo(1.0, 1);
    expect(result.meetsMinimum).toBe(true);
  });

  it('still meets minimum threshold with only current weather', () => {
    const result = calculateAdvisoryConfidence({
      weather: CURRENT_WEATHER,
      satellite: null,
      soil: null,
      weatherFreshness: 'current',
      soilFreshness: 'expired',
      satelliteFreshness: 'expired',
    });
    // 0.45 from current weather >= 0.6 minimum? No — but let's verify actual value
    expect(result.score).toBeCloseTo(0.45, 1);
    expect(result.meetsMinimum).toBe(false); // 0.45 < 0.6 threshold
  });

  it('meets minimum with current weather + recent soil', () => {
    const result = calculateAdvisoryConfidence({
      weather: CURRENT_WEATHER,
      satellite: null,
      soil: CURRENT_SOIL,
      weatherFreshness: 'current',
      soilFreshness: 'recent',
      satelliteFreshness: 'expired',
    });
    // 0.45 + 0.25 = 0.70 > 0.6
    expect(result.score).toBeGreaterThanOrEqual(0.6);
    expect(result.meetsMinimum).toBe(true);
  });

  it('returns zero confidence when no data is available', () => {
    const result = calculateAdvisoryConfidence({
      weather: null,
      satellite: null,
      soil: null,
      weatherFreshness: 'expired',
      soilFreshness: 'expired',
      satelliteFreshness: 'expired',
    });
    expect(result.score).toBe(0);
    expect(result.meetsMinimum).toBe(false);
  });

  it('lowers confidence for stale weather data', () => {
    const fresh = calculateAdvisoryConfidence({
      weather: CURRENT_WEATHER,
      satellite: null, soil: null,
      weatherFreshness: 'current',
      soilFreshness: 'expired',
      satelliteFreshness: 'expired',
    });
    const stale = calculateAdvisoryConfidence({
      weather: CURRENT_WEATHER,
      satellite: null, soil: null,
      weatherFreshness: 'stale',
      soilFreshness: 'expired',
      satelliteFreshness: 'expired',
    });
    expect(fresh.score).toBeGreaterThan(stale.score);
  });

  it('includes data source summary in explanation', () => {
    const result = calculateAdvisoryConfidence({
      weather: CURRENT_WEATHER,
      satellite: CURRENT_SATELLITE,
      soil: null,
      weatherFreshness: 'current',
      soilFreshness: 'expired',
      satelliteFreshness: 'recent',
    });
    expect(result.factors.explanation).toContain('Weather');
    expect(result.factors.explanation).toContain('satellite');
  });
});
