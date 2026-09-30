/**
 * Internal domain types for the Advisory Engine.
 * Decoupled from both ORM and HTTP layers.
 */

import type {
  AdvisoryCategory,
  RiskLevel,
  DataType,
} from '@prisma/client';
import type {
  AdvisoryEvidence,
  GeoPoint,
  SupportedLanguage,
  WeatherObservation,
  SatelliteObservation,
  SoilObservation,
} from '@brics-agrin/shared';

// ─── Advisory Engine Input ────────────────────────────────────────────────────

export interface AdvisoryEngineInput {
  farmId: string;
  cropCycleId?: string;
  location: GeoPoint;
  country: string;
  cropName: string;
  cropVariety?: string;
  growthStage: string;
  farmingPractice: string;
  irrigationType: string;
  areaHectares: number;
  language: SupportedLanguage;
  // Fetched data — may be undefined if provider unavailable
  weather?: WeatherObservation;
  soil?: SoilObservation;
  satellite?: SatelliteObservation;
}

// ─── Advisory Engine Output ───────────────────────────────────────────────────

export interface AdvisoryEngineOutput {
  category: AdvisoryCategory;
  recommendation: string;
  reason: string;
  actionTiming: string;
  riskAddressed: string;
  environmentalImpact: string;
  confidence: number;
  riskLevel: RiskLevel;
  evidence: AdvisoryEvidence;
  modelVersion: string;
  generatedAt: Date;
  expiresAt: Date;
}

// ─── Rule Engine ──────────────────────────────────────────────────────────────

export interface AgriculturalRule {
  id: string;
  category: AdvisoryCategory;
  description: string;
  /**
   * Returns a recommendation if the rule triggers, null otherwise.
   * Rules are deterministic — no AI inference inside a rule.
   */
  evaluate(input: AdvisoryEngineInput): RuleResult | null;
}

export interface RuleResult {
  recommendation: string;
  reason: string;
  actionTiming: string;
  riskAddressed: string;
  environmentalImpact: string;
  riskLevel: RiskLevel;
  dataType: DataType;
}

// ─── Data collection context ─────────────────────────────────────────────────

export interface AgriculturalDataContext {
  weather: WeatherObservation | null;
  soil: SoilObservation | null;
  satellite: SatelliteObservation | null;
  weatherFreshness: string;
  soilFreshness: string;
  satelliteFreshness: string;
}
