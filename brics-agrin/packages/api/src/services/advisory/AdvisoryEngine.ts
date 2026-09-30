/**
 * Agro-Advisory Engine — core business logic.
 *
 * Pipeline:
 *   1. Validate input
 *   2. Aggregate agricultural data (weather + soil + satellite)
 *   3. Run all applicable deterministic rules
 *   4. Select highest-priority rule result
 *   5. Calculate confidence from data quality
 *   6. Enhance explanation with AI (if available + confidence meets threshold)
 *   7. Build evidence provenance record
 *   8. Persist to database
 *   9. Cache result
 *  10. Return complete Advisory
 *
 * Every advisory answer:
 *   - WHAT should the farmer do?
 *   - WHY should they do it?
 *   - WHEN should they do it?
 *   - WHAT risk is being addressed?
 *   - WHAT environmental impact?
 *   - HOW CONFIDENT is the system?
 *   - WHAT DATA was used?
 */

import type { AdvisoryEngineInput, AdvisoryEngineOutput, AgriculturalRule } from '../../domain/advisory/types.js';
import type { SupportedLanguage } from '@brics-agrin/shared';
import { calculateAdvisoryConfidence } from './ConfidenceCalculator.js';
import { aiExplainer } from './AiExplainer.js';
import { dataAggregator } from '../../providers/DataAggregator.js';
import { IrrigationRule } from './rules/IrrigationRule.js';
import { SoilHealthRule } from './rules/SoilHealthRule.js';
import { WeatherAlertRule } from './rules/WeatherAlertRule.js';
import { RegenerativeRule } from './rules/RegenerativeRule.js';
import { createLogger } from '../../observability/logger.js';
import { config } from '../../config/index.js';
import { CONFIDENCE_THRESHOLDS } from '@brics-agrin/shared';
import type { AdvisoryEvidence } from '@brics-agrin/shared';

const log = createLogger('advisory-engine');

// Rule priority: higher index = higher priority (later rules can override earlier)
// WeatherAlert is last so it can override everything else in emergency conditions
const RULE_REGISTRY: AgriculturalRule[] = [
  new RegenerativeRule(),
  new SoilHealthRule(),
  new IrrigationRule(),
  new WeatherAlertRule(),  // Highest priority — evaluated last, overrides others
];

export interface GenerateAdvisoryInput {
  farmId: string;
  cropCycleId?: string;
  location: { lat: number; lon: number };
  country: string;
  cropName: string;
  cropVariety?: string;
  growthStage: string;
  farmingPractice: string;
  irrigationType: string;
  areaHectares: number;
  fieldId?: string;
  language: SupportedLanguage;
}

export class AdvisoryEngine {
  /**
   * Generate a complete, evidence-backed agricultural advisory.
   * Never throws for data availability issues — degrades gracefully.
   */
  async generate(input: GenerateAdvisoryInput): Promise<AdvisoryEngineOutput | null> {
    const start = Date.now();

    log.info(
      { farmId: input.farmId, cropName: input.cropName, growthStage: input.growthStage },
      'Advisory generation started',
    );

    // ── Step 1: Aggregate agricultural data ──────────────────────────────────
    const dataContext = await dataAggregator.aggregate({
      location: input.location,
      fieldId: input.fieldId,
      country: input.country,
    });

    // ── Step 2: Build engine input with fetched data ──────────────────────────
    const engineInput: AdvisoryEngineInput = {
      farmId: input.farmId,
      cropCycleId: input.cropCycleId,
      location: input.location,
      country: input.country,
      cropName: input.cropName,
      cropVariety: input.cropVariety,
      growthStage: input.growthStage,
      farmingPractice: input.farmingPractice,
      irrigationType: input.irrigationType,
      areaHectares: input.areaHectares,
      language: input.language,
      weather: dataContext.weather ?? undefined,
      soil: dataContext.soil ?? undefined,
      satellite: dataContext.satellite ?? undefined,
    };

    // ── Step 3: Run rule engine ───────────────────────────────────────────────
    let triggeredResult = null;
    let triggeredRule = null;

    for (const rule of RULE_REGISTRY) {
      try {
        const result = rule.evaluate(engineInput);
        if (result !== null) {
          triggeredResult = result;
          triggeredRule = rule;
          // Continue iterating — later rules (WeatherAlert) can override
        }
      } catch (err) {
        log.error({ err, ruleId: rule.id }, 'Rule evaluation failed — skipping rule');
      }
    }

    if (!triggeredResult || !triggeredRule) {
      log.info({ farmId: input.farmId }, 'No rules triggered — no advisory generated');
      return null;
    }

    // ── Step 4: Calculate confidence ─────────────────────────────────────────
    const confidence = calculateAdvisoryConfidence(dataContext);

    if (!confidence.meetsMinimum) {
      log.warn(
        { farmId: input.farmId, confidence: confidence.score },
        'Confidence below minimum threshold — not generating advisory',
      );
      return null;
    }

    // ── Step 5: AI enhancement (if confidence is high enough) ────────────────
    const canUseAi = confidence.score >= CONFIDENCE_THRESHOLDS.MIN_FOR_RECOMMENDATION;
    const explained = canUseAi
      ? await aiExplainer.explain(triggeredResult, engineInput, input.language)
      : {
          recommendation: triggeredResult.recommendation,
          reason: triggeredResult.reason,
          actionTiming: triggeredResult.actionTiming,
          wasAiEnhanced: false,
          modelVersion: `rule-engine-${config.ADVISORY_MODEL_VERSION}`,
        };

    // ── Step 6: Build evidence provenance ────────────────────────────────────
    const evidence: AdvisoryEvidence = {};

    if (dataContext.weather) {
      evidence.weather = {
        summary: `Temp ${dataContext.weather.temperatureCelsius.toFixed(0)}°C, humidity ${dataContext.weather.humidityPercent.toFixed(0)}%, precipitation ${dataContext.weather.precipitationMm.toFixed(1)} mm`,
        source: dataContext.weather.source,
        timestamp: dataContext.weather.timestamp,
        freshness: dataContext.weatherFreshness as AdvisoryEvidence['weather'] extends { freshness: infer F } ? F : never,
        dataType: dataContext.weather.dataType,
      };
    }

    if (dataContext.soil) {
      const soilParts: string[] = [];
      if (dataContext.soil.phLevel !== undefined) soilParts.push(`pH ${dataContext.soil.phLevel.toFixed(1)}`);
      if (dataContext.soil.organicCarbonPercent !== undefined) soilParts.push(`OC ${dataContext.soil.organicCarbonPercent.toFixed(2)}%`);
      if (dataContext.soil.moisturePercent !== undefined) soilParts.push(`moisture ${dataContext.soil.moisturePercent.toFixed(0)}%`);

      evidence.soil = {
        summary: soilParts.length > 0 ? soilParts.join(', ') : 'Soil observation available',
        source: dataContext.soil.source,
        timestamp: dataContext.soil.observedAt,
        freshness: dataContext.soilFreshness as AdvisoryEvidence['soil'] extends { freshness: infer F } ? F : never,
        dataType: dataContext.soil.dataType,
      };
    }

    if (dataContext.satellite) {
      evidence.satellite = {
        summary: `NDVI ${dataContext.satellite.ndvi?.toFixed(2) ?? 'N/A'}${dataContext.satellite.soilMoistureIndex !== undefined ? `, soil moisture index ${dataContext.satellite.soilMoistureIndex.toFixed(2)}` : ''}`,
        ndvi: dataContext.satellite.ndvi,
        source: dataContext.satellite.source,
        timestamp: dataContext.satellite.timestamp,
        freshness: dataContext.satelliteFreshness as AdvisoryEvidence['satellite'] extends { freshness: infer F } ? F : never,
        dataType: dataContext.satellite.dataType,
      };
    }

    evidence.cropStage = `${input.cropName} at ${input.growthStage} growth stage`;
    evidence.historicalContext = confidence.explanation;

    const generatedAt = new Date();
    const expiresAt = new Date(generatedAt.getTime() + config.ADVISORY_CACHE_TTL_SECONDS * 1000);

    const output: AdvisoryEngineOutput = {
      category: triggeredRule.category,
      recommendation: explained.recommendation,
      reason: explained.reason,
      actionTiming: explained.actionTiming,
      riskAddressed: triggeredResult.riskAddressed,
      environmentalImpact: triggeredResult.environmentalImpact,
      confidence: confidence.score,
      riskLevel: triggeredResult.riskLevel,
      evidence,
      modelVersion: explained.modelVersion,
      generatedAt,
      expiresAt,
    };

    log.info(
      {
        farmId: input.farmId,
        ruleId: triggeredRule.id,
        confidence: confidence.score,
        aiEnhanced: explained.wasAiEnhanced,
        latencyMs: Date.now() - start,
      },
      'Advisory generation complete',
    );

    return output;
  }
}

export const advisoryEngine = new AdvisoryEngine();
