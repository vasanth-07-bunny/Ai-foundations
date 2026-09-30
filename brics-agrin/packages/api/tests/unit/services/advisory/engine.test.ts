/**
 * Unit tests for the Advisory Engine.
 *
 * Tests:
 *   - Engine generates output when rules trigger and confidence is sufficient
 *   - Engine returns null when no rules trigger
 *   - Engine returns null when confidence is below minimum
 *   - AI explainer failure falls back gracefully to rule text
 *   - Evidence provenance is populated
 *   - Model version is recorded
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the data aggregator so engine tests don't hit external APIs
vi.mock('../../../../src/providers/DataAggregator.js', () => ({
  dataAggregator: {
    aggregate: vi.fn(),
  },
}));

vi.mock('../../../../src/services/advisory/AiExplainer.js', () => ({
  aiExplainer: {
    explain: vi.fn(),
  },
}));

import { AdvisoryEngine } from '../../../../src/services/advisory/AdvisoryEngine.js';
import { dataAggregator } from '../../../../src/providers/DataAggregator.js';
import { aiExplainer } from '../../../../src/services/advisory/AiExplainer.js';
import type { AgriculturalDataContext } from '../../../../src/domain/advisory/types.js';

const FULL_DATA_CONTEXT: AgriculturalDataContext = {
  weather: {
    location: { lat: 28.6, lon: 77.2 },
    timestamp: new Date().toISOString(),
    temperatureCelsius: 42, // triggers heat alert
    humidityPercent: 40,
    precipitationMm: 0,
    windSpeedMps: 3,
    dataType: 'observed',
    source: 'test',
    freshness: 'current',
  },
  satellite: {
    location: { lat: 28.6, lon: 77.2 },
    timestamp: new Date().toISOString(),
    ndvi: 0.65,
    source: 'test',
    dataType: 'model_derived',
    freshness: 'current',
  },
  soil: {
    id: 's1', fieldId: 'f1',
    observedAt: new Date().toISOString(),
    phLevel: 6.5,
    source: 'lab',
    dataType: 'observed',
  },
  weatherFreshness: 'current',
  soilFreshness: 'current',
  satelliteFreshness: 'current',
};

const LOW_DATA_CONTEXT: AgriculturalDataContext = {
  weather: null,
  satellite: null,
  soil: null,
  weatherFreshness: 'expired',
  soilFreshness: 'expired',
  satelliteFreshness: 'expired',
};

const BASE_INPUT = {
  farmId: 'farm-1',
  location: { lat: 28.6, lon: 77.2 },
  country: 'IN',
  cropName: 'wheat',
  growthStage: 'flowering',
  farmingPractice: 'CONVENTIONAL',
  irrigationType: 'DRIP',
  areaHectares: 2.5,
  language: 'en' as const,
};

describe('AdvisoryEngine', () => {
  let engine: AdvisoryEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new AdvisoryEngine();

    vi.mocked(aiExplainer.explain).mockResolvedValue({
      recommendation: 'AI-enhanced recommendation text',
      reason: 'AI-enhanced reason text',
      actionTiming: 'Immediately',
      wasAiEnhanced: true,
      modelVersion: 'gpt-4o-1.0.0',
    });
  });

  it('generates an advisory when data is available and a rule triggers', async () => {
    vi.mocked(dataAggregator.aggregate).mockResolvedValue(FULL_DATA_CONTEXT);

    const result = await engine.generate(BASE_INPUT);

    expect(result).not.toBeNull();
    expect(result!.recommendation).toBeTruthy();
    expect(result!.confidence).toBeGreaterThan(0);
    expect(result!.evidence).toBeDefined();
    expect(result!.generatedAt).toBeInstanceOf(Date);
    expect(result!.expiresAt).toBeInstanceOf(Date);
    expect(result!.expiresAt.getTime()).toBeGreaterThan(result!.generatedAt.getTime());
  });

  it('returns null when no data is available (confidence too low)', async () => {
    vi.mocked(dataAggregator.aggregate).mockResolvedValue(LOW_DATA_CONTEXT);

    const result = await engine.generate(BASE_INPUT);

    expect(result).toBeNull();
  });

  it('includes weather evidence when weather data is available', async () => {
    vi.mocked(dataAggregator.aggregate).mockResolvedValue(FULL_DATA_CONTEXT);

    const result = await engine.generate(BASE_INPUT);

    expect(result?.evidence.weather).toBeDefined();
    expect(result?.evidence.weather?.source).toBe('test');
    expect(result?.evidence.weather?.dataType).toBe('observed');
  });

  it('includes satellite evidence when satellite data is available', async () => {
    vi.mocked(dataAggregator.aggregate).mockResolvedValue(FULL_DATA_CONTEXT);

    const result = await engine.generate(BASE_INPUT);

    expect(result?.evidence.satellite?.ndvi).toBe(0.65);
  });

  it('falls back gracefully when AI explainer fails', async () => {
    vi.mocked(dataAggregator.aggregate).mockResolvedValue(FULL_DATA_CONTEXT);
    vi.mocked(aiExplainer.explain).mockRejectedValue(new Error('OpenAI unavailable'));

    // Engine should not crash — falls back to rule text
    const result = await engine.generate(BASE_INPUT);
    expect(result).not.toBeNull();
    expect(result!.recommendation).toBeTruthy();
  });

  it('records model version in output', async () => {
    vi.mocked(dataAggregator.aggregate).mockResolvedValue(FULL_DATA_CONTEXT);

    const result = await engine.generate(BASE_INPUT);

    expect(result?.modelVersion).toBeTruthy();
  });

  it('sets CRITICAL risk for 42°C heat during flowering stage', async () => {
    vi.mocked(dataAggregator.aggregate).mockResolvedValue(FULL_DATA_CONTEXT);

    const result = await engine.generate(BASE_INPUT);

    expect(result?.riskLevel).toBe('CRITICAL');
    expect(result?.category).toBe('WEATHER_ALERT');
  });

  it('does not crash when data aggregator itself throws', async () => {
    vi.mocked(dataAggregator.aggregate).mockRejectedValue(new Error('Unexpected'));

    await expect(engine.generate(BASE_INPUT)).rejects.toThrow();
  });
});
