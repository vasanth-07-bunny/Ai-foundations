/**
 * Diagnostic confidence evaluator — Stage 4 of the pipeline.
 *
 * Converts raw model predictions into a structured, validated result.
 *
 * Rules:
 *   - Only predictions above MIN_INDIVIDUAL_SCORE are included
 *   - If top prediction is below MIN_FOR_DISEASE_DIAGNOSIS → LOW_CONFIDENCE
 *   - If top two predictions are within AMBIGUITY_THRESHOLD → INCONCLUSIVE
 *   - 'healthy' label with high confidence is a valid positive result
 *   - Expert consultation required when confidence < HIGH_CONFIDENCE
 *
 * NEVER present uncertain predictions as definitive diagnoses.
 */

import type {
  ModelClassifyOutput,
  DiagnosticConditionResult,
  NormalizedDiagnosticResult,
} from '../../domain/diagnostic/types.js';
import { CONFIDENCE_THRESHOLDS } from '@brics-agrin/shared';
import type { DiagnosticStatus, RiskLevel } from '@prisma/client';

const MIN_INDIVIDUAL_SCORE = 0.05;   // Drop predictions below 5%
const AMBIGUITY_THRESHOLD = 0.15;    // Top two within 15% = ambiguous
const MAX_CONDITIONS_RETURNED = 3;   // Show top 3 at most

// Disease severity mapping — conservative defaults
const SEVERITY_MAP: Record<string, RiskLevel> = {
  healthy: 'LOW',
  leaf_spot: 'MEDIUM',
  powdery_mildew: 'MEDIUM',
  rust: 'HIGH',
  leaf_rust: 'HIGH',
  blight: 'HIGH',
  blast: 'CRITICAL',
  wheat_blast: 'CRITICAL',
  bacterial_blight: 'HIGH',
  fusarium_wilt: 'HIGH',
  common_smut: 'MEDIUM',
  gray_leaf_spot: 'MEDIUM',
  northern_corn_leaf_blight: 'HIGH',
  stalk_rot: 'HIGH',
  brown_planthopper_damage: 'HIGH',
  sheath_blight: 'MEDIUM',
  leaf_curl_virus: 'CRITICAL',
  boll_weevil_damage: 'HIGH',
  septoria_leaf_blotch: 'MEDIUM',
};

const CONDITION_DESCRIPTIONS: Record<string, string> = {
  healthy: 'No disease symptoms detected. Crop appears healthy.',
  leaf_spot: 'Circular or irregular spots on leaves. May indicate fungal or bacterial infection.',
  powdery_mildew: 'White powdery coating on leaf surfaces. Caused by fungal pathogens.',
  rust: 'Orange/brown pustules on leaves. A fungal disease that spreads rapidly in humid conditions.',
  leaf_rust: 'Orange pustules primarily on lower leaf surfaces. Spreads rapidly under moderate temperatures.',
  blight: 'Widespread browning and death of leaf tissue. Can be fungal or bacterial.',
  blast: 'Diamond-shaped lesions on leaves and neck rot. Severe fungal disease requiring urgent attention.',
  wheat_blast: 'Bleached spikes and grain abortion. Highly destructive fungal disease.',
  bacterial_blight: 'Water-soaked lesions turning yellow to brown. Bacterial infection.',
  fusarium_wilt: 'Yellowing and wilting from soil-borne fungal infection of vascular tissue.',
  common_smut: 'Large galls replacing kernels. Fungal smut disease.',
  gray_leaf_spot: 'Rectangular gray-brown lesions along leaf veins. Fungal disease favoured by high humidity.',
  northern_corn_leaf_blight: 'Long cigar-shaped gray-green to tan lesions on leaves.',
  stalk_rot: 'Internal stem decay causing lodging risk. Multiple fungal/bacterial causes.',
  brown_planthopper_damage: 'Hopper burn — circular yellowing patches from sap-sucking insect.',
  sheath_blight: 'Elliptical lesions with gray centres on leaf sheaths. Soil-borne fungal disease.',
  leaf_curl_virus: 'Leaf curling, thickening, and distortion caused by whitefly-transmitted virus.',
  boll_weevil_damage: 'Entry holes in bolls, premature boll drop. Insect pest damage.',
  septoria_leaf_blotch: 'Tan lesions with yellow margins and dark specks. Fungal disease spreading upward.',
};

const SAFE_NEXT_STEPS: Record<string, string[]> = {
  healthy: ['Continue regular monitoring.', 'Maintain current crop management practices.'],
  default_disease: [
    'Isolate the affected area if possible to prevent spread.',
    'Consult a local agricultural extension officer for confirmation.',
    'Do not apply chemical treatments until a confirmed diagnosis is obtained.',
    'Document affected field sections with photographs for follow-up.',
  ],
  blast: [
    'URGENT: Contact your local agricultural extension service immediately.',
    'Isolate affected fields — this disease spreads rapidly.',
    'Do not move plant material between fields.',
    'Remove and destroy severely affected plants.',
  ],
  wheat_blast: [
    'URGENT: Report to agricultural authorities — this is a notifiable disease in some countries.',
    'Quarantine affected fields. Do not harvest seed from affected areas.',
    'Contact local extension service for emergency guidance.',
  ],
};

export class ConfidenceEvaluator {
  evaluate(
    output: ModelClassifyOutput,
    modelVersion: string,
  ): NormalizedDiagnosticResult {
    const { predictions } = output;

    if (!predictions || predictions.length === 0) {
      return this.buildLowConfidenceResult(0, modelVersion, 'No predictions returned by model');
    }

    // Filter noise
    const filtered = predictions
      .filter((p) => p.score >= MIN_INDIVIDUAL_SCORE)
      .slice(0, MAX_CONDITIONS_RETURNED);

    if (filtered.length === 0) {
      return this.buildLowConfidenceResult(0, modelVersion, 'All predictions below minimum threshold');
    }

    const top = filtered[0]!;
    const second = filtered[1];
    const overallConfidence = top.score;

    // ── Low confidence gate ───────────────────────────────────────────────────
    if (overallConfidence < CONFIDENCE_THRESHOLDS.MIN_FOR_DISEASE_DIAGNOSIS) {
      return this.buildLowConfidenceResult(overallConfidence, modelVersion);
    }

    // ── Ambiguity check ───────────────────────────────────────────────────────
    const isAmbiguous =
      second !== undefined &&
      top.score - second.score < AMBIGUITY_THRESHOLD;

    if (isAmbiguous) {
      return this.buildInconclusiveResult(filtered, overallConfidence, modelVersion);
    }

    // ── Build normalized conditions ───────────────────────────────────────────
    const conditions: DiagnosticConditionResult[] = filtered.map((p) => ({
      name: p.label,
      confidence: p.score,
      description: CONDITION_DESCRIPTIONS[p.label] ?? `Possible condition: ${p.label}`,
      severity: SEVERITY_MAP[p.label] ?? 'MEDIUM',
    }));

    const topCondition = conditions[0]!;
    const requiresExpert =
      overallConfidence < CONFIDENCE_THRESHOLDS.HIGH_CONFIDENCE ||
      topCondition.name !== 'healthy';

    const nextSteps =
      SAFE_NEXT_STEPS[topCondition.name] ??
      SAFE_NEXT_STEPS['default_disease']!;

    return {
      status: 'COMPLETED',
      conditions,
      topCondition,
      overallConfidence,
      requiresExpertConsultation: requiresExpert,
      safeNextSteps: nextSteps,
      disclaimer: this.buildDisclaimer(overallConfidence, topCondition.name),
      modelVersion,
      diagnosedAt: new Date(),
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private buildLowConfidenceResult(
    confidence: number,
    modelVersion: string,
    reason = 'Model confidence is below the minimum required for a reliable diagnosis',
  ): NormalizedDiagnosticResult {
    return {
      status: 'LOW_CONFIDENCE',
      conditions: [],
      topCondition: null,
      overallConfidence: confidence,
      requiresExpertConsultation: true,
      safeNextSteps: [
        'The image quality or crop condition was not sufficient for a reliable automated diagnosis.',
        'Take a clearer, closer photograph of the affected plant tissue in good lighting.',
        'Consult a local agricultural extension officer or agronomist for a manual diagnosis.',
      ],
      disclaimer: reason,
      modelVersion,
      diagnosedAt: new Date(),
    };
  }

  private buildInconclusiveResult(
    predictions: Array<{ label: string; score: number }>,
    confidence: number,
    modelVersion: string,
  ): NormalizedDiagnosticResult {
    const conditions: DiagnosticConditionResult[] = predictions.map((p) => ({
      name: p.label,
      confidence: p.score,
      description: CONDITION_DESCRIPTIONS[p.label] ?? `Possible condition: ${p.label}`,
      severity: SEVERITY_MAP[p.label] ?? 'MEDIUM',
    }));

    return {
      status: 'INCONCLUSIVE',
      conditions,
      topCondition: null, // Deliberately null — result is inconclusive
      overallConfidence: confidence,
      requiresExpertConsultation: true,
      safeNextSteps: [
        `The model identified multiple possible conditions with similar probability. Expert verification is required.`,
        ...( SAFE_NEXT_STEPS['default_disease'] ?? []),
      ],
      disclaimer:
        'Multiple conditions were identified with similar confidence scores. This result is inconclusive and must not be used as a definitive diagnosis without expert verification.',
      modelVersion,
      diagnosedAt: new Date(),
    };
  }

  private buildDisclaimer(confidence: number, conditionName: string): string {
    const pct = (confidence * 100).toFixed(0);
    if (conditionName === 'healthy') {
      return `The model assessed this sample as likely healthy with ${pct}% confidence. This is an automated screening result. Regular field monitoring is still recommended.`;
    }
    return `This is an automated screening result with ${pct}% confidence. It is NOT a definitive diagnosis. Always verify with a certified agronomist or agricultural extension officer before applying any treatments.`;
  }
}

export const confidenceEvaluator = new ConfidenceEvaluator();
