/**
 * Stub ML model provider.
 *
 * Returns deterministic, seeded predictions for testing and for
 * demonstrating the pipeline without a real model deployment.
 *
 * The predictions are clearly labeled as 'model_derived' and include
 * realistic confidence distributions to exercise the full pipeline.
 *
 * In production, replace with:
 *   - LocalModelProvider (ONNX Runtime / TFLite)
 *   - RemoteModelProvider (HuggingFace Inference API / SageMaker / Vertex AI)
 */

import type {
  DiagnosticModelProvider,
  ModelClassifyInput,
  ModelClassifyOutput,
} from '../../../domain/diagnostic/types.js';
import { createLogger } from '../../../observability/logger.js';

const log = createLogger('model:stub');

// Common crop diseases per crop type — realistic domain data
const DISEASE_MAP: Record<string, string[]> = {
  wheat: ['wheat_blast', 'leaf_rust', 'powdery_mildew', 'septoria_leaf_blotch', 'healthy'],
  rice: ['blast', 'bacterial_blight', 'brown_planthopper_damage', 'sheath_blight', 'healthy'],
  maize: ['gray_leaf_spot', 'northern_corn_leaf_blight', 'common_smut', 'stalk_rot', 'healthy'],
  cotton: ['bacterial_blight', 'leaf_curl_virus', 'boll_weevil_damage', 'fusarium_wilt', 'healthy'],
  default: ['leaf_spot', 'powdery_mildew', 'rust', 'blight', 'healthy'],
};

export class StubModelProvider implements DiagnosticModelProvider {
  readonly modelId = 'stub-disease-classifier';
  readonly modelVersion = '0.1.0-stub';

  async classify(input: ModelClassifyInput): Promise<ModelClassifyOutput> {
    const start = Date.now();

    // Use image buffer length as a seed for deterministic but varied output
    const seed = input.imageBuffer.length % 100;
    const cropKey = Object.keys(DISEASE_MAP).find((k) =>
      input.cropName.toLowerCase().includes(k),
    ) ?? 'default';

    const diseases = DISEASE_MAP[cropKey] ?? DISEASE_MAP.default!;

    // Generate a realistic-looking softmax distribution
    const scores = this.generateScores(diseases.length, seed);
    const predictions = diseases.map((label, i) => ({
      label,
      score: scores[i] ?? 0,
    }));

    // Sort descending by score
    predictions.sort((a, b) => b.score - a.score);

    log.debug(
      { cropName: input.cropName, topPrediction: predictions[0]?.label },
      'Stub model inference complete',
    );

    return {
      predictions,
      processingTimeMs: Date.now() - start,
    };
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }

  /**
   * Generate a softmax-like distribution over n classes.
   * seed determines which class gets the highest score.
   */
  private generateScores(n: number, seed: number): number[] {
    const raw = Array.from({ length: n }, (_, i) => {
      // Primary class gets boosted score
      if (i === seed % n) return 3.0 + (seed % 20) * 0.05;
      if (i === (seed + 1) % n) return 1.5 + Math.random() * 0.5;
      return 0.1 + Math.random() * 0.3;
    });

    // Softmax
    const expValues = raw.map((v) => Math.exp(v));
    const sum = expValues.reduce((a, b) => a + b, 0);
    return expValues.map((v) => parseFloat((v / sum).toFixed(4)));
  }
}
