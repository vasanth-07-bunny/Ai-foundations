/**
 * Irrigation Advisory Rule.
 *
 * Evaluates whether irrigation is needed, should be reduced, or is
 * on schedule — based on:
 *   - Recent precipitation
 *   - Soil moisture (if available)
 *   - Temperature and humidity
 *   - Crop growth stage (water demand varies)
 *   - Irrigation type
 *
 * The rule never says "use less water" — it explains WHY based on data.
 */

import { BaseRule } from './BaseRule.js';
import type { AdvisoryEngineInput, RuleResult } from '../../../domain/advisory/types.js';

// ── Crop water demand by growth stage (mm/day approximate) ───────────────────
const CROP_WATER_DEMAND_MM_PER_DAY: Record<string, number> = {
  germination:   3,
  seedling:      4,
  vegetative:    5,
  tillering:     6,
  jointing:      7,
  booting:       8,
  heading:       8,
  flowering:     9,
  grain_filling: 7,
  maturity:      4,
  harvest:       2,
};

export class IrrigationRule extends BaseRule {
  readonly id = 'irrigation-v1';
  readonly category = 'IRRIGATION' as const;
  readonly description = 'Irrigation scheduling based on weather, soil moisture, and crop stage';

  evaluate(input: AdvisoryEngineInput): RuleResult | null {
    const { weather, soil, growthStage, irrigationType } = input;

    // Skip for rainfed farms — we still give weather-based guidance
    // but don't frame it as irrigation scheduling
    if (irrigationType === 'RAINFED') return null;

    if (!weather) return null;

    const expectedDemandMm = CROP_WATER_DEMAND_MM_PER_DAY[growthStage.toLowerCase()] ?? 5;
    const recentRainfallMm = weather.precipitationMm;
    const soilMoisture = soil?.moisturePercent;
    const tempC = weather.temperatureCelsius;
    const humidityPct = weather.humidityPercent;

    // High heat + low humidity = higher evapotranspiration
    const evapotranspirationFactor = tempC > 35 ? 1.3 : tempC > 28 ? 1.1 : 1.0;
    const adjustedDemandMm = expectedDemandMm * evapotranspirationFactor;
    const deficitMm = Math.max(0, adjustedDemandMm - recentRainfallMm);

    // Case 1: Recent rainfall already covers demand — suggest skipping irrigation
    if (recentRainfallMm >= adjustedDemandMm * 0.9) {
      // Double-check with soil moisture if available
      if (soilMoisture && soilMoisture < 30) {
        // Soil still dry despite rain — might be drainage issue, proceed with light irrigation
        return {
          recommendation:
            `Despite recent rainfall of ${recentRainfallMm.toFixed(1)} mm, soil moisture is low at ${soilMoisture.toFixed(0)}%. Apply a light irrigation of ${(deficitMm * 0.5).toFixed(0)} mm to address the moisture deficit.`,
          reason:
            `Current rainfall (${recentRainfallMm.toFixed(1)} mm) approaches estimated crop water demand (${adjustedDemandMm.toFixed(1)} mm/day for ${growthStage} stage), but soil moisture (${soilMoisture.toFixed(0)}%) remains below adequate levels. The discrepancy may indicate drainage or soil structure issues.`,
          actionTiming: 'Within the next 24 hours, preferably early morning to reduce evaporation losses',
          riskAddressed: 'Moisture stress during critical crop growth stage',
          environmentalImpact: 'Targeted irrigation reduces water waste and prevents over-watering',
          riskLevel: 'MEDIUM',
          dataType: 'rule_based',
        };
      }

      return {
        recommendation:
          `Irrigation can be deferred today. Recent rainfall (${recentRainfallMm.toFixed(1)} mm) has met the estimated crop water demand of ${adjustedDemandMm.toFixed(1)} mm/day for the ${growthStage} growth stage.`,
        reason:
          `Based on current weather data, rainfall exceeds the crop water requirement${soilMoisture ? ` and soil moisture is adequate at ${soilMoisture.toFixed(0)}%` : ''}. Applying additional water at this time risks waterlogging and nutrient leaching.`,
        actionTiming: 'Re-evaluate in 24–48 hours based on updated weather',
        riskAddressed: 'Over-irrigation, waterlogging, and nutrient leaching',
        environmentalImpact: 'Deferring irrigation conserves water resources and prevents leaching of soil nutrients',
        riskLevel: 'LOW',
        dataType: 'rule_based',
      };
    }

    // Case 2: Deficit — irrigation recommended
    if (deficitMm > 0) {
      const urgency = deficitMm > adjustedDemandMm * 0.7 ? 'HIGH' : 'MEDIUM';
      return {
        recommendation:
          `Apply approximately ${deficitMm.toFixed(0)} mm of irrigation${irrigationType === 'DRIP' ? ' through the drip system' : irrigationType === 'SPRINKLER' ? ' via sprinklers' : ''}. This accounts for today's rainfall deficit versus crop water demand.`,
        reason:
          `Estimated crop water demand for ${growthStage} stage is ${adjustedDemandMm.toFixed(1)} mm/day. Recent rainfall of ${recentRainfallMm.toFixed(1)} mm covers only ${((recentRainfallMm / adjustedDemandMm) * 100).toFixed(0)}% of this requirement. Temperature of ${tempC.toFixed(0)}°C and humidity of ${humidityPct.toFixed(0)}% indicate${tempC > 35 ? ' high' : ' moderate'} evapotranspiration.`,
        actionTiming: 'Early morning (before 9 AM) or late evening (after 6 PM) to minimise evaporation loss',
        riskAddressed: 'Moisture stress and yield reduction due to water deficit',
        environmentalImpact: 'Deficit-based irrigation applies only the water required, reducing consumption and runoff',
        riskLevel: urgency as 'HIGH' | 'MEDIUM',
        dataType: 'rule_based',
      };
    }

    return null;
  }
}
