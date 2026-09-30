/**
 * Unit tests for ConfidenceEvaluator.
 *
 * Tests:
 *   - High-confidence single condition → COMPLETED
 *   - Low-confidence → LOW_CONFIDENCE, requiresExpert=true
 *   - Two conditions within 15% → INCONCLUSIVE, topCondition=null
 *   - Healthy detection → LOW risk, no expert required at high confidence
 *   - Empty predictions → LOW_CONFIDENCE
 *   - All predictions below min score → LOW_CONFIDENCE
 *   - CRITICAL disease → always requiresExpert=true
 */

import { describe, it, expect } from 'vitest';
import { ConfidenceEvaluator } from '../../../../src/services/diagnostic/ConfidenceEvaluator.js';
import type { ModelClassifyOutput } from '../../../../src/domain/diagnostic/types.js';

const MODEL_VERSION = '1.0.0-test';

describe('ConfidenceEvaluator', () => {
  const evaluator = new ConfidenceEvaluator();

  it('returns COMPLETED status for high-confidence single diagnosis', () => {
    const output: ModelClassifyOutput = {
      predictions: [
        { label: 'leaf_rust', score: 0.92 },
        { label: 'healthy', score: 0.05 },
        { label: 'powdery_mildew', score: 0.03 },
      ],
      processingTimeMs: 120,
    };
    const result = evaluator.evaluate(output, MODEL_VERSION);

    expect(result.status).toBe('COMPLETED');
    expect(result.topCondition?.name).toBe('leaf_rust');
    expect(result.topCondition?.confidence).toBe(0.92);
    expect(result.topCondition?.severity).toBe('HIGH');
    expect(result.requiresExpertConsultation).toBe(true); // Not HIGH_CONFIDENCE (0.85+)
    expect(result.safeNextSteps.length).toBeGreaterThan(0);
    expect(result.disclaimer).toContain('92%');
  });

  it('returns COMPLETED with requiresExpert=false for healthy at very high confidence', () => {
    const output: ModelClassifyOutput = {
      predictions: [
        { label: 'healthy', score: 0.96 },
        { label: 'leaf_spot', score: 0.04 },
      ],
      processingTimeMs: 80,
    };
    const result = evaluator.evaluate(output, MODEL_VERSION);

    expect(result.status).toBe('COMPLETED');
    expect(result.topCondition?.name).toBe('healthy');
    expect(result.topCondition?.severity).toBe('LOW');
    expect(result.requiresExpertConsultation).toBe(false); // Healthy + high confidence
  });

  it('returns LOW_CONFIDENCE when top prediction is below 0.7', () => {
    const output: ModelClassifyOutput = {
      predictions: [
        { label: 'rust', score: 0.55 },
        { label: 'healthy', score: 0.30 },
        { label: 'blight', score: 0.15 },
      ],
      processingTimeMs: 100,
    };
    const result = evaluator.evaluate(output, MODEL_VERSION);

    expect(result.status).toBe('LOW_CONFIDENCE');
    expect(result.topCondition).toBeNull();
    expect(result.requiresExpertConsultation).toBe(true);
    expect(result.safeNextSteps).toContain(
      expect.stringContaining('clearer')
    );
  });

  it('returns INCONCLUSIVE when top two predictions are within 15%', () => {
    const output: ModelClassifyOutput = {
      predictions: [
        { label: 'blast', score: 0.78 },
        { label: 'blight', score: 0.68 },
        { label: 'healthy', score: 0.04 },
      ],
      processingTimeMs: 110,
    };
    const result = evaluator.evaluate(output, MODEL_VERSION);

    expect(result.status).toBe('INCONCLUSIVE');
    expect(result.topCondition).toBeNull();
    expect(result.conditions.length).toBeGreaterThanOrEqual(2);
    expect(result.requiresExpertConsultation).toBe(true);
    expect(result.disclaimer).toContain('inconclusive');
  });

  it('returns LOW_CONFIDENCE for empty predictions array', () => {
    const output: ModelClassifyOutput = {
      predictions: [],
      processingTimeMs: 10,
    };
    const result = evaluator.evaluate(output, MODEL_VERSION);

    expect(result.status).toBe('LOW_CONFIDENCE');
    expect(result.conditions).toHaveLength(0);
  });

  it('filters out predictions below minimum score threshold', () => {
    const output: ModelClassifyOutput = {
      predictions: [
        { label: 'rust', score: 0.92 },
        { label: 'blight', score: 0.03 }, // Below 0.05 threshold
        { label: 'healthy', score: 0.02 }, // Below threshold
      ],
      processingTimeMs: 90,
    };
    const result = evaluator.evaluate(output, MODEL_VERSION);

    expect(result.status).toBe('COMPLETED');
    expect(result.conditions).toHaveLength(1); // Only rust passes filter
  });

  it('caps returned conditions at 3', () => {
    const output: ModelClassifyOutput = {
      predictions: [
        { label: 'rust', score: 0.85 },
        { label: 'blight', score: 0.06 },
        { label: 'leaf_spot', score: 0.05 },
        { label: 'healthy', score: 0.04 },
      ],
      processingTimeMs: 100,
    };
    const result = evaluator.evaluate(output, MODEL_VERSION);

    expect(result.conditions.length).toBeLessThanOrEqual(3);
  });

  it('CRITICAL disease always has requiresExpert=true even at high confidence', () => {
    const output: ModelClassifyOutput = {
      predictions: [
        { label: 'blast', score: 0.97 },
        { label: 'healthy', score: 0.03 },
      ],
      processingTimeMs: 95,
    };
    const result = evaluator.evaluate(output, MODEL_VERSION);

    expect(result.topCondition?.severity).toBe('CRITICAL');
    expect(result.requiresExpertConsultation).toBe(true);
  });

  it('includes model version in result', () => {
    const output: ModelClassifyOutput = {
      predictions: [{ label: 'healthy', score: 0.95 }],
      processingTimeMs: 50,
    };
    const result = evaluator.evaluate(output, MODEL_VERSION);

    expect(result.modelVersion).toBe(MODEL_VERSION);
  });
});
