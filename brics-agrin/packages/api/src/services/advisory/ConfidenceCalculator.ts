/**
 * Advisory confidence calculator.
 *
 * Confidence reflects DATA QUALITY — how much reliable data was
 * available to generate the recommendation. It does NOT reflect
 * how certain the AI model is about its text generation.
 *
 * Factors that raise confidence:
 *   - Fresh weather data
 *   - Soil observation available
 *   - Satellite data available
 *   - Multiple confirming data signals
 *
 * Factors that lower confidence:
 *   - Stale or missing weather data
 *   - No soil data
 *   - No satellite data
 *   - Only one data source
 */

import type { AgriculturalDataContext } from '../../domain/advisory/types.js';
import { CONFIDENCE_THRESHOLDS } from '@brics-agrin/shared';

interface ConfidenceFactors {
  weatherAvailable: boolean;
  weatherFreshness: string;
  soilAvailable: boolean;
  soilFreshness: string;
  satelliteAvailable: boolean;
  satelliteFreshness: string;
  ruleTriggered: boolean;
}

export interface ConfidenceResult {
  score: number;       // 0–1
  meetsMinimum: boolean;
  factors: ConfidenceFactors;
  explanation: string;
}

export function calculateAdvisoryConfidence(
  context: AgriculturalDataContext,
): ConfidenceResult {
  let score = 0.0;
  const explanationParts: string[] = [];

  const factors: ConfidenceFactors = {
    weatherAvailable: !!context.weather,
    weatherFreshness: context.weatherFreshness,
    soilAvailable: !!context.soil,
    soilFreshness: context.soilFreshness,
    satelliteAvailable: !!context.satellite,
    satelliteFreshness: context.satelliteFreshness,
    ruleTriggered: true, // caller ensures this
  };

  // ── Weather contribution (max 0.45) ──────────────────────────────────────
  if (context.weather) {
    switch (context.weatherFreshness) {
      case 'current': score += 0.45; break;
      case 'recent':  score += 0.30; break;
      case 'stale':   score += 0.15; break;
      case 'expired': score += 0.0;  break;
    }
    explanationParts.push(`Weather (${context.weatherFreshness})`);
  } else {
    explanationParts.push('No weather data');
  }

  // ── Soil contribution (max 0.30) ──────────────────────────────────────────
  if (context.soil) {
    switch (context.soilFreshness) {
      case 'current': score += 0.30; break;
      case 'recent':  score += 0.25; break;
      case 'stale':   score += 0.15; break;
      case 'expired': score += 0.05; break;
    }
    explanationParts.push(`Soil observation (${context.soilFreshness})`);
  } else {
    explanationParts.push('No soil data');
  }

  // ── Satellite contribution (max 0.25) ─────────────────────────────────────
  if (context.satellite) {
    switch (context.satelliteFreshness) {
      case 'current': score += 0.25; break;
      case 'recent':  score += 0.20; break;
      case 'stale':   score += 0.10; break;
      case 'expired': score += 0.02; break;
    }
    explanationParts.push(`Satellite data (${context.satelliteFreshness})`);
  } else {
    explanationParts.push('No satellite data');
  }

  const clampedScore = Math.min(1.0, Math.max(0.0, score));

  return {
    score: parseFloat(clampedScore.toFixed(3)),
    meetsMinimum: clampedScore >= CONFIDENCE_THRESHOLDS.MIN_FOR_RECOMMENDATION,
    factors,
    explanation: `Advisory based on: ${explanationParts.join(', ')}`,
  };
}
