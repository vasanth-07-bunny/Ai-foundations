/**
 * Unit tests for the DiagnosticPipelineService.
 *
 * AI edge cases:
 *   - Model returns empty predictions → LOW_CONFIDENCE result (not crash)
 *   - Model inference throws → FAILED result (not 500 error)
 *   - Invalid image → ImageValidationError thrown before model is called
 *   - Low-quality image (valid but tiny) → validation rejection
 *   - Model returns all predictions below threshold → LOW_CONFIDENCE
 *   - Model returns ambiguous results → INCONCLUSIVE
 *   - Very high confidence → requiresExpertConsultation can be false
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 640, height: 480 }),
    resize: vi.fn().mockReturnThis(),
    removeAlpha: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.alloc(1000)),
  })),
}));

import { DiagnosticPipelineService } from '../../../../src/services/diagnostic/DiagnosticPipelineService.js';
import { ImageValidationError } from '../../../../src/utils/errors.js';
import type { DiagnosticModelProvider, ModelClassifyInput, ModelClassifyOutput } from '../../../../src/domain/diagnostic/types.js';

// JPEG magic bytes
const VALID_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Buffer.alloc(200, 0xaa)]);

function makeProvider(predictions: Array<{ label: string; score: number }>): DiagnosticModelProvider {
  return {
    modelId: 'test-model',
    modelVersion: '1.0.0-test',
    classify: vi.fn().mockResolvedValue({
      predictions,
      processingTimeMs: 50,
    } as ModelClassifyOutput),
    isHealthy: vi.fn().mockResolvedValue(true),
  };
}

describe('DiagnosticPipelineService', () => {
  describe('Image validation gate', () => {
    it('rejects images with disallowed MIME type before calling model', async () => {
      const provider = makeProvider([{ label: 'healthy', score: 0.99 }]);
      const pipeline = new DiagnosticPipelineService(provider);

      await expect(
        pipeline.runFromBuffer(VALID_JPEG, 'application/pdf', 'wheat', 'vegetative'),
      ).rejects.toThrow(ImageValidationError);

      expect(provider.classify).not.toHaveBeenCalled();
    });

    it('rejects oversized files before calling model', async () => {
      const provider = makeProvider([{ label: 'healthy', score: 0.99 }]);
      const pipeline = new DiagnosticPipelineService(provider);
      const oversized = Buffer.alloc(11 * 1024 * 1024); // 11 MB

      await expect(
        pipeline.runFromBuffer(oversized, 'image/jpeg', 'wheat', 'vegetative'),
      ).rejects.toThrow(ImageValidationError);

      expect(provider.classify).not.toHaveBeenCalled();
    });
  });

  describe('AI model edge cases', () => {
    it('returns FAILED (not throws) when model inference fails', async () => {
      const provider: DiagnosticModelProvider = {
        modelId: 'test',
        modelVersion: '1.0.0',
        classify: vi.fn().mockRejectedValue(new Error('Model server unavailable')),
        isHealthy: vi.fn().mockResolvedValue(false),
      };
      const pipeline = new DiagnosticPipelineService(provider);

      const result = await pipeline.runFromBuffer(VALID_JPEG, 'image/jpeg', 'wheat', 'vegetative');

      expect(result.status).toBe('FAILED');
      expect(result.requiresExpertConsultation).toBe(true);
      expect(result.safeNextSteps.length).toBeGreaterThan(0);
      // Disclaimer must NOT say the crop is healthy on failure
      expect(result.disclaimer).not.toContain('healthy');
    });

    it('returns LOW_CONFIDENCE when model returns empty predictions', async () => {
      const provider = makeProvider([]);
      const pipeline = new DiagnosticPipelineService(provider);

      const result = await pipeline.runFromBuffer(VALID_JPEG, 'image/jpeg', 'rice', 'tillering');

      expect(result.status).toBe('LOW_CONFIDENCE');
      expect(result.topCondition).toBeNull();
      expect(result.requiresExpertConsultation).toBe(true);
    });

    it('returns LOW_CONFIDENCE when all predictions below minimum threshold', async () => {
      const provider = makeProvider([
        { label: 'blast', score: 0.03 },
        { label: 'rust', score: 0.02 },
        { label: 'healthy', score: 0.04 },
      ]);
      const pipeline = new DiagnosticPipelineService(provider);

      const result = await pipeline.runFromBuffer(VALID_JPEG, 'image/jpeg', 'wheat', 'heading');

      expect(result.status).toBe('LOW_CONFIDENCE');
      expect(result.conditions).toHaveLength(0);
    });

    it('returns LOW_CONFIDENCE when top prediction below 0.7 threshold', async () => {
      const provider = makeProvider([
        { label: 'leaf_rust', score: 0.55 },
        { label: 'powdery_mildew', score: 0.35 },
        { label: 'healthy', score: 0.10 },
      ]);
      const pipeline = new DiagnosticPipelineService(provider);

      const result = await pipeline.runFromBuffer(VALID_JPEG, 'image/jpeg', 'wheat', 'vegetative');

      expect(result.status).toBe('LOW_CONFIDENCE');
      expect(result.topCondition).toBeNull();
    });

    it('returns INCONCLUSIVE when top two predictions are within 15%', async () => {
      const provider = makeProvider([
        { label: 'blast', score: 0.78 },
        { label: 'bacterial_blight', score: 0.68 },
        { label: 'healthy', score: 0.04 },
      ]);
      const pipeline = new DiagnosticPipelineService(provider);

      const result = await pipeline.runFromBuffer(VALID_JPEG, 'image/jpeg', 'rice', 'vegetative');

      expect(result.status).toBe('INCONCLUSIVE');
      expect(result.topCondition).toBeNull(); // Deliberately null — result is ambiguous
      expect(result.disclaimer).toContain('inconclusive');
    });

    it('returns COMPLETED with CRITICAL severity for blast disease', async () => {
      const provider = makeProvider([
        { label: 'blast', score: 0.95 },
        { label: 'healthy', score: 0.05 },
      ]);
      const pipeline = new DiagnosticPipelineService(provider);

      const result = await pipeline.runFromBuffer(VALID_JPEG, 'image/jpeg', 'rice', 'heading');

      expect(result.status).toBe('COMPLETED');
      expect(result.topCondition?.severity).toBe('CRITICAL');
      expect(result.requiresExpertConsultation).toBe(true);
    });

    it('COMPLETED healthy at very high confidence does not require expert', async () => {
      const provider = makeProvider([
        { label: 'healthy', score: 0.97 },
        { label: 'leaf_spot', score: 0.03 },
      ]);
      const pipeline = new DiagnosticPipelineService(provider);

      const result = await pipeline.runFromBuffer(VALID_JPEG, 'image/jpeg', 'maize', 'vegetative');

      expect(result.status).toBe('COMPLETED');
      expect(result.topCondition?.name).toBe('healthy');
      expect(result.requiresExpertConsultation).toBe(false);
    });

    it('always includes a disclaimer in every result', async () => {
      const provider = makeProvider([{ label: 'rust', score: 0.90 }]);
      const pipeline = new DiagnosticPipelineService(provider);

      const result = await pipeline.runFromBuffer(VALID_JPEG, 'image/jpeg', 'wheat', 'grain_filling');

      expect(result.disclaimer).toBeTruthy();
      expect(result.disclaimer.length).toBeGreaterThan(10);
    });

    it('model version is recorded in result', async () => {
      const provider = makeProvider([{ label: 'healthy', score: 0.90 }]);
      const pipeline = new DiagnosticPipelineService(provider);

      const result = await pipeline.runFromBuffer(VALID_JPEG, 'image/jpeg', 'wheat', 'maturity');

      expect(result.modelVersion).toBe('1.0.0-test');
    });
  });
});
