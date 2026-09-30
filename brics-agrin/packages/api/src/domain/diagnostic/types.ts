/**
 * Internal domain types for the Crop Disease Diagnostic pipeline.
 */

import type { DiagnosticStatus, RiskLevel } from '@prisma/client';
import type { CropGrowthStage } from '@brics-agrin/shared';

// ─── Model Provider Interface ─────────────────────────────────────────────────
// Abstraction over any concrete ML model — local, remote, or future provider.

export interface DiagnosticModelProvider {
  readonly modelId: string;
  readonly modelVersion: string;

  /**
   * Classify a preprocessed image buffer.
   * Returns raw classification output — confidence evaluation happens outside.
   */
  classify(input: ModelClassifyInput): Promise<ModelClassifyOutput>;

  /**
   * Health check — verify the model provider is reachable and loaded.
   */
  isHealthy(): Promise<boolean>;
}

export interface ModelClassifyInput {
  imageBuffer: Buffer;
  cropName: string;
  growthStage: string;
  widthPx: number;
  heightPx: number;
}

export interface ModelClassifyOutput {
  predictions: RawPrediction[];
  processingTimeMs: number;
}

export interface RawPrediction {
  label: string;
  score: number;  // 0–1, raw model output — NOT yet validated
}

// ─── Diagnostic Pipeline Stages ───────────────────────────────────────────────

export interface ImageValidationResult {
  isValid: boolean;
  mimeType: string;
  widthPx: number;
  heightPx: number;
  sizeBytes: number;
  rejectionReason?: string;
}

export interface ProcessedImage {
  buffer: Buffer;
  widthPx: number;
  heightPx: number;
  mimeType: string;
  fileHash: string;  // SHA-256 hex
}

export interface DiagnosticConditionResult {
  name: string;
  confidence: number;
  description: string;
  severity: RiskLevel;
}

export interface NormalizedDiagnosticResult {
  status: DiagnosticStatus;
  conditions: DiagnosticConditionResult[];
  topCondition: DiagnosticConditionResult | null;
  overallConfidence: number;
  requiresExpertConsultation: boolean;
  safeNextSteps: string[];
  disclaimer: string;
  modelVersion: string;
  diagnosedAt: Date;
}

// ─── Diagnostic Request (internal) ───────────────────────────────────────────

export interface DiagnosticJobPayload {
  diagnosticId: string;
  farmId: string;
  imageStorageKey: string;
  cropName: string;
  growthStage: CropGrowthStage;
  notes?: string;
}
