/**
 * Shared constants used across the BRICS AgriN platform.
 * These values are stable and agricultural-domain-specific.
 */

export const CROP_GROWTH_STAGES = [
  'germination',
  'seedling',
  'vegetative',
  'tillering',
  'jointing',
  'booting',
  'heading',
  'flowering',
  'grain_filling',
  'maturity',
  'harvest',
] as const;

export type CropGrowthStage = (typeof CROP_GROWTH_STAGES)[number];

export const FARMING_PRACTICES = [
  'conventional',
  'organic',
  'integrated',
  'regenerative',
  'zero_tillage',
  'mixed',
] as const;

export type FarmingPractice = (typeof FARMING_PRACTICES)[number];

export const IRRIGATION_TYPES = [
  'rainfed',
  'canal',
  'drip',
  'sprinkler',
  'flood',
  'furrow',
  'subsurface',
] as const;

export type IrrigationType = (typeof IRRIGATION_TYPES)[number];

export const FARM_CATEGORIES = [
  'marginal',   // < 1 hectare
  'small',      // 1–2 hectares
  'semi_medium', // 2–4 hectares
  'medium',     // 4–10 hectares
  'large',      // > 10 hectares
] as const;

export type FarmCategory = (typeof FARM_CATEGORIES)[number];

export const SUPPORTED_LANGUAGES = ['en', 'hi', 'pt', 'ru', 'zh', 'ar', 'fr'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const SUPPORTED_COUNTRIES = ['IN', 'BR', 'RU', 'CN', 'ZA', 'ET', 'EG', 'IR', 'SA', 'AE'] as const;
export type SupportedCountry = (typeof SUPPORTED_COUNTRIES)[number];

export const RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const DATA_FRESHNESS = ['current', 'recent', 'stale', 'expired'] as const;
export type DataFreshness = (typeof DATA_FRESHNESS)[number];

/** Data type classification for provenance/transparency */
export const DATA_TYPES = [
  'observed',            // Actual sensor/field measurement
  'predicted',           // Model-forecasted value
  'model_derived',       // Derived from a model (e.g., NDVI from satellite)
  'rule_based',          // Deterministic rule output
  'ai_generated',        // LLM / ML model output
  'historical',          // Historical average / baseline
] as const;

export type DataType = (typeof DATA_TYPES)[number];

export const ADVISORY_CATEGORIES = [
  'irrigation',
  'fertilization',
  'pest_management',
  'disease_management',
  'harvest_timing',
  'soil_health',
  'crop_rotation',
  'weather_alert',
  'regenerative_practice',
  'general',
] as const;

export type AdvisoryCategory = (typeof ADVISORY_CATEGORIES)[number];

export const CONFIDENCE_THRESHOLDS = {
  MIN_FOR_RECOMMENDATION: 0.6,
  MIN_FOR_DISEASE_DIAGNOSIS: 0.7,
  HIGH_CONFIDENCE: 0.85,
} as const;

export const API_VERSION = 'v1' as const;

export const PAGINATION_DEFAULTS = {
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;
