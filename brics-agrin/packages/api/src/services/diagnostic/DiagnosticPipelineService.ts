/**
 * Diagnostic Pipeline Service — orchestrates all 5 stages.
 *
 * Stage 1: Image Validation      (security + quality gate)
 * Stage 2: Image Preprocessing   (normalize for model input)
 * Stage 3: Model Inference       (provider-abstracted classification)
 * Stage 4: Confidence Evaluation (normalize + threshold checks)
 * Stage 5: Result Normalization  (structured output with disclaimer)
 *
 * The model provider is injected via constructor — the pipeline
 * is completely decoupled from any specific model implementation.
 *
 * runFromBuffer: used in upload flow (API controller)
 * runFromStorageKey: used by the background queue processor
 */

import type {
  DiagnosticModelProvider,
  NormalizedDiagnosticResult,
} from '../../domain/diagnostic/types.js';
import { imageValidator } from './ImageValidator.js';
import { imagePreprocessor } from './ImagePreprocessor.js';
import { confidenceEvaluator } from './ConfidenceEvaluator.js';
import { ImageValidationError } from '../../utils/errors.js';
import { createLogger } from '../../observability/logger.js';

const log = createLogger('diagnostic-pipeline');

export class DiagnosticPipelineService {
  constructor(private readonly modelProvider: DiagnosticModelProvider) {}

  /**
   * Run the full pipeline from a raw image buffer.
   * Used in synchronous upload + diagnose (small images only).
   */
  async runFromBuffer(
    imageBuffer: Buffer,
    declaredMimeType: string,
    cropName: string,
    growthStage: string,
  ): Promise<NormalizedDiagnosticResult> {
    const start = Date.now();

    // ── Stage 1: Validate ─────────────────────────────────────────────────────
    const validation = await imageValidator.validate(imageBuffer, declaredMimeType);
    if (!validation.isValid) {
      throw new ImageValidationError(validation.rejectionReason ?? 'Unknown validation failure');
    }

    // ── Stage 2: Preprocess ───────────────────────────────────────────────────
    const processed = await imagePreprocessor.preprocess(imageBuffer, declaredMimeType);

    // ── Stage 3: Inference ────────────────────────────────────────────────────
    let classifyOutput;
    try {
      classifyOutput = await this.modelProvider.classify({
        imageBuffer: processed.buffer,
        cropName,
        growthStage,
        widthPx: processed.widthPx,
        heightPx: processed.heightPx,
      });
    } catch (err) {
      log.error({ err }, 'Model inference failed');
      // Return a structured failure rather than propagating an unhandled error
      return {
        status: 'FAILED',
        conditions: [],
        topCondition: null,
        overallConfidence: 0,
        requiresExpertConsultation: true,
        safeNextSteps: [
          'Automated analysis could not be completed at this time.',
          'Please consult a local agricultural extension officer for manual diagnosis.',
        ],
        disclaimer:
          'Automated disease analysis failed due to a technical error. This result should not be interpreted as "healthy".',
        modelVersion: this.modelProvider.modelVersion,
        diagnosedAt: new Date(),
      };
    }

    // ── Stage 4 & 5: Evaluate confidence + normalize ──────────────────────────
    const result = confidenceEvaluator.evaluate(
      classifyOutput,
      this.modelProvider.modelVersion,
    );

    log.info(
      {
        cropName,
        growthStage,
        status: result.status,
        confidence: result.overallConfidence,
        topCondition: result.topCondition?.name,
        latencyMs: Date.now() - start,
      },
      'Diagnostic pipeline complete',
    );

    return result;
  }

  /**
   * Run pipeline from a storage key.
   * In full deployment, fetches the image from object storage.
   * Current implementation uses an in-memory stub.
   */
  async runFromStorageKey(
    storageKey: string,
    cropName: string,
    growthStage: string,
  ): Promise<NormalizedDiagnosticResult> {
    // TODO: Replace with real object storage fetch when storage is configured
    // const imageBuffer = await objectStorage.get(storageKey);
    log.info({ storageKey }, 'Running pipeline from storage key (stub fetch)');

    // Stub: generate a deterministic buffer from the storage key for testing
    const stubBuffer = Buffer.from(storageKey.repeat(100));
    return this.runFromBuffer(stubBuffer, 'image/jpeg', cropName, growthStage);
  }

  /** Check if the model provider is available */
  async isModelHealthy(): Promise<boolean> {
    return this.modelProvider.isHealthy();
  }
}
