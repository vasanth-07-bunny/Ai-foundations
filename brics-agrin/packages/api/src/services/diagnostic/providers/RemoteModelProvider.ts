/**
 * Remote ML model provider.
 *
 * Calls a remote inference endpoint (e.g. HuggingFace Inference API,
 * SageMaker endpoint, or custom FastAPI server) to classify a crop image.
 *
 * The interface contract is identical to StubModelProvider so the
 * pipeline can swap between them without any code changes.
 *
 * Authentication: Bearer token via SATELLITE_API_KEY (reused config)
 * — or extend config with a dedicated INFERENCE_API_KEY variable.
 */

import type {
  DiagnosticModelProvider,
  ModelClassifyInput,
  ModelClassifyOutput,
  RawPrediction,
} from '../../../domain/diagnostic/types.js';
import axios from 'axios';
import { createLogger } from '../../../observability/logger.js';
import { ExternalProviderError } from '../../../utils/errors.js';
import { config } from '../../../config/index.js';

const log = createLogger('model:remote');

interface RemoteInferenceResponse {
  predictions: Array<{ label: string; score: number }>;
  processing_time_ms?: number;
}

export class RemoteModelProvider implements DiagnosticModelProvider {
  readonly modelId: string;
  readonly modelVersion: string;
  private readonly endpointUrl: string;
  private readonly apiKey: string | undefined;

  constructor(params: {
    endpointUrl: string;
    modelId: string;
    modelVersion: string;
    apiKey?: string;
  }) {
    this.endpointUrl = params.endpointUrl;
    this.modelId = params.modelId;
    this.modelVersion = params.modelVersion;
    this.apiKey = params.apiKey;
  }

  async classify(input: ModelClassifyInput): Promise<ModelClassifyOutput> {
    const start = Date.now();

    try {
      // Send image as multipart form data
      const formData = new FormData();
      const blob = new Blob([input.imageBuffer], { type: 'image/jpeg' });
      formData.append('image', blob, 'crop.jpg');
      formData.append('crop_name', input.cropName);
      formData.append('growth_stage', input.growthStage);

      const response = await axios.post<RemoteInferenceResponse>(
        this.endpointUrl,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
          },
          timeout: config.EXTERNAL_HTTP_TIMEOUT_MS,
        },
      );

      const predictions: RawPrediction[] = response.data.predictions.map((p) => ({
        label: p.label,
        score: p.score,
      }));

      return {
        predictions,
        processingTimeMs: response.data.processing_time_ms ?? Date.now() - start,
      };
    } catch (err) {
      log.error({ err, endpointUrl: this.endpointUrl }, 'Remote model inference failed');
      throw new ExternalProviderError('ml-inference', String(err));
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      await axios.get(`${this.endpointUrl}/health`, {
        timeout: 3000,
        headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
      });
      return true;
    } catch {
      return false;
    }
  }
}
