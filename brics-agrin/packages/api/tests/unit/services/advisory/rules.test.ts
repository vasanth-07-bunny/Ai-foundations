/**
 * Unit tests for agricultural rules.
 *
 * Rules are pure functions — no external dependencies.
 * Tests cover both triggering conditions and non-triggering conditions.
 */

import { describe, it, expect } from 'vitest';
import { IrrigationRule } from '../../../../src/services/advisory/rules/IrrigationRule.js';
import { SoilHealthRule } from '../../../../src/services/advisory/rules/SoilHealthRule.js';
import { WeatherAlertRule } from '../../../../src/services/advisory/rules/WeatherAlertRule.js';
import { RegenerativeRule } from '../../../../src/services/advisory/rules/RegenerativeRule.js';
import type { AdvisoryEngineInput } from '../../../../src/domain/advisory/types.js';

const BASE_INPUT: AdvisoryEngineInput = {
  farmId: 'farm-1',
  location: { lat: 28.6, lon: 77.2 },
  country: 'IN',
  cropName: 'wheat',
  growthStage: 'vegetative',
  farmingPractice: 'CONVENTIONAL',
  irrigationType: 'DRIP',
  areaHectares: 2.5,
  language: 'en',
  weather: {
    location: { lat: 28.6, lon: 77.2 },
    timestamp: new Date().toISOString(),
    temperatureCelsius: 25,
    humidityPercent: 60,
    precipitationMm: 1,
    windSpeedMps: 3,
    dataType: 'observed',
    source: 'test',
    freshness: 'current',
  },
};

// ── IrrigationRule ────────────────────────────────────────────────────────────
describe('IrrigationRule', () => {
  const rule = new IrrigationRule();

  it('recommends irrigation when precipitation is low relative to crop demand', () => {
    const result = rule.evaluate({
      ...BASE_INPUT,
      weather: { ...BASE_INPUT.weather!, precipitationMm: 0 },
    });
    expect(result).not.toBeNull();
    expect(result?.recommendation).toContain('mm');
    expect(result?.riskLevel).toMatch(/MEDIUM|HIGH/);
  });

  it('defers irrigation when recent rainfall covers crop demand', () => {
    const result = rule.evaluate({
      ...BASE_INPUT,
      weather: { ...BASE_INPUT.weather!, precipitationMm: 12, temperatureCelsius: 22 },
    });
    expect(result).not.toBeNull();
    expect(result?.recommendation).toMatch(/defer|skip/i);
    expect(result?.riskLevel).toBe('LOW');
  });

  it('returns null for rainfed farms (no managed irrigation)', () => {
    const result = rule.evaluate({
      ...BASE_INPUT,
      irrigationType: 'RAINFED',
    });
    expect(result).toBeNull();
  });

  it('returns null when no weather data is available', () => {
    const result = rule.evaluate({ ...BASE_INPUT, weather: undefined });
    expect(result).toBeNull();
  });

  it('escalates risk to HIGH during critical growth stage with severe deficit', () => {
    const result = rule.evaluate({
      ...BASE_INPUT,
      growthStage: 'flowering',
      weather: { ...BASE_INPUT.weather!, precipitationMm: 0, temperatureCelsius: 38 },
    });
    expect(result?.riskLevel).toBe('HIGH');
  });
});

// ── SoilHealthRule ────────────────────────────────────────────────────────────
describe('SoilHealthRule', () => {
  const rule = new SoilHealthRule();

  it('recommends lime for acidic soil pH < 5.5', () => {
    const result = rule.evaluate({
      ...BASE_INPUT,
      soil: {
        id: 's1', fieldId: 'f1', observedAt: new Date().toISOString(),
        phLevel: 4.8, source: 'lab', dataType: 'observed',
      },
    });
    expect(result).not.toBeNull();
    expect(result?.recommendation).toMatch(/lime/i);
    expect(result?.riskLevel).toBe('HIGH');
  });

  it('recommends sulphur for alkaline soil pH > 7.5', () => {
    const result = rule.evaluate({
      ...BASE_INPUT,
      soil: {
        id: 's1', fieldId: 'f1', observedAt: new Date().toISOString(),
        phLevel: 8.1, source: 'lab', dataType: 'observed',
      },
    });
    expect(result).not.toBeNull();
    expect(result?.recommendation).toMatch(/sulphur|acidif/i);
    expect(result?.riskLevel).toBe('MEDIUM');
  });

  it('flags critically low organic carbon', () => {
    const result = rule.evaluate({
      ...BASE_INPUT,
      soil: {
        id: 's1', fieldId: 'f1', observedAt: new Date().toISOString(),
        organicCarbonPercent: 0.3, source: 'lab', dataType: 'observed',
      },
    });
    expect(result).not.toBeNull();
    expect(result?.recommendation).toMatch(/organic|compost/i);
    expect(result?.riskLevel).toBe('HIGH');
  });

  it('returns null when no soil data available', () => {
    const result = rule.evaluate({ ...BASE_INPUT, soil: undefined });
    expect(result).toBeNull();
  });
});

// ── WeatherAlertRule ──────────────────────────────────────────────────────────
describe('WeatherAlertRule', () => {
  const rule = new WeatherAlertRule();

  it('triggers CRITICAL heat alert during flowering stage at 38°C+', () => {
    const result = rule.evaluate({
      ...BASE_INPUT,
      growthStage: 'flowering',
      weather: { ...BASE_INPUT.weather!, temperatureCelsius: 40 },
    });
    expect(result?.riskLevel).toBe('CRITICAL');
    expect(result?.recommendation).toMatch(/URGENT|irrigat/i);
  });

  it('triggers HIGH heat alert during non-critical stage', () => {
    const result = rule.evaluate({
      ...BASE_INPUT,
      growthStage: 'vegetative',
      weather: { ...BASE_INPUT.weather!, temperatureCelsius: 39 },
    });
    expect(result?.riskLevel).toBe('HIGH');
  });

  it('triggers frost warning at 4°C', () => {
    const result = rule.evaluate({
      ...BASE_INPUT,
      weather: { ...BASE_INPUT.weather!, temperatureCelsius: 4 },
    });
    expect(result).not.toBeNull();
    expect(result?.recommendation).toMatch(/frost/i);
    expect(result?.riskLevel).toBe('HIGH');
  });

  it('does not trigger frost warning at harvest stage', () => {
    const result = rule.evaluate({
      ...BASE_INPUT,
      growthStage: 'harvest',
      weather: { ...BASE_INPUT.weather!, temperatureCelsius: 4 },
    });
    expect(result).toBeNull();
  });

  it('triggers heavy rain alert at 55mm precipitation', () => {
    const result = rule.evaluate({
      ...BASE_INPUT,
      weather: { ...BASE_INPUT.weather!, precipitationMm: 55 },
    });
    expect(result).not.toBeNull();
    expect(result?.recommendation).toMatch(/drain/i);
    expect(result?.riskLevel).toBe('HIGH');
  });

  it('returns null for normal conditions', () => {
    const result = rule.evaluate(BASE_INPUT);
    expect(result).toBeNull();
  });
});

// ── RegenerativeRule ──────────────────────────────────────────────────────────
describe('RegenerativeRule', () => {
  const rule = new RegenerativeRule();

  it('recommends cover cropping at harvest stage for conventional farms', () => {
    const result = rule.evaluate({
      ...BASE_INPUT,
      growthStage: 'harvest',
      farmingPractice: 'CONVENTIONAL',
    });
    expect(result).not.toBeNull();
    expect(result?.recommendation).toMatch(/cover crop|legum/i);
    expect(result?.category).toBe('REGENERATIVE_PRACTICE');
  });

  it('does not recommend cover crop if already regenerative', () => {
    const result = rule.evaluate({
      ...BASE_INPUT,
      growthStage: 'harvest',
      farmingPractice: 'REGENERATIVE',
    });
    // May still return rotation advice, but NOT cover crop advice for already-regenerative
    if (result) {
      expect(result.recommendation).not.toMatch(/cover crop.*consider/i);
    }
  });

  it('flags low NDVI during vegetative stage', () => {
    const result = rule.evaluate({
      ...BASE_INPUT,
      growthStage: 'vegetative',
      satellite: {
        location: { lat: 28.6, lon: 77.2 },
        timestamp: new Date().toISOString(),
        ndvi: 0.2,
        source: 'test',
        dataType: 'model_derived',
        freshness: 'current',
      },
    });
    expect(result).not.toBeNull();
    expect(result?.recommendation).toMatch(/NDVI|inspection/i);
  });
});
