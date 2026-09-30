/**
 * Weather Alert Rule.
 *
 * Detects extreme weather conditions that require immediate farmer action:
 *   - High heat stress (>38°C)
 *   - Heavy rain / flood risk (>50mm precipitation)
 *   - Frost risk (<5°C)
 *   - High wind (>15 m/s)
 *   - High UV index (>8) during flowering/grain fill
 *
 * These are CRITICAL/HIGH priority advisories that override routine guidance.
 */

import { BaseRule } from './BaseRule.js';
import type { AdvisoryEngineInput, RuleResult } from '../../../domain/advisory/types.js';

export class WeatherAlertRule extends BaseRule {
  readonly id = 'weather-alert-v1';
  readonly category = 'WEATHER_ALERT' as const;
  readonly description = 'Extreme weather condition detection and emergency guidance';

  evaluate(input: AdvisoryEngineInput): RuleResult | null {
    const { weather, growthStage, cropName } = input;

    if (!weather) return null;

    const temp = weather.temperatureCelsius;
    const rain = weather.precipitationMm;
    const wind = weather.windSpeedMps;
    const uv = weather.uvIndex;

    // ── Heat stress (>38°C) ───────────────────────────────────────────────────
    if (temp >= 38) {
      const isCriticalStage = ['flowering', 'grain_filling', 'heading'].includes(
        growthStage.toLowerCase(),
      );
      return {
        recommendation: isCriticalStage
          ? `URGENT: Temperature of ${temp.toFixed(0)}°C is above heat stress threshold during ${growthStage} stage of ${cropName}. Irrigate immediately if possible, preferably by evening. Consider applying a kaolin clay spray if available to reduce leaf temperature.`
          : `Temperature of ${temp.toFixed(0)}°C exceeds heat stress threshold. If irrigation is available, schedule for early morning or late evening. Ensure adequate soil moisture to buffer heat impact on root zone.`,
        reason:
          `Temperatures above 38°C cause cellular damage in most field crops${isCriticalStage ? `, and ${growthStage} is a critical stage where heat stress directly reduces grain set and final yield` : ''}. At ${temp.toFixed(0)}°C, evapotranspiration is approximately ${((temp - 25) * 0.05 + 1).toFixed(1)}x baseline rate.`,
        actionTiming: isCriticalStage ? 'Immediately' : 'Within the next 6–12 hours',
        riskAddressed: 'Heat stress, pollen sterility, grain set failure, and severe yield loss',
        environmentalImpact: 'Protective irrigation during extreme heat prevents crop loss, reducing the need to replant and associated resource use',
        riskLevel: isCriticalStage ? 'CRITICAL' : 'HIGH',
        dataType: 'rule_based',
      };
    }

    // ── Frost risk (<5°C) ─────────────────────────────────────────────────────
    if (temp <= 5 && !['harvest', 'maturity'].includes(growthStage.toLowerCase())) {
      return {
        recommendation:
          `Frost risk detected: temperature at ${temp.toFixed(0)}°C. If irrigation is available, apply light overhead irrigation before sunrise — water releases latent heat and can protect crops to about 2°C below air temperature. Cover seedlings or young plants with frost cloth if available.`,
        reason:
          `Air temperature at or below 5°C poses frost risk for ${cropName} at ${growthStage} stage. Frost causes ice crystal formation in plant tissues, destroying cell membranes and causing wilting or death of plant tissue.`,
        actionTiming: 'Before sunrise — frost typically most severe in pre-dawn hours',
        riskAddressed: 'Frost damage, tissue death, and complete crop loss in severe cases',
        environmentalImpact: 'Frost protection irrigation uses water efficiently as it provides direct crop protection',
        riskLevel: 'HIGH',
        dataType: 'rule_based',
      };
    }

    // ── Extreme rainfall / flood risk (>50mm) ────────────────────────────────
    if (rain >= 50) {
      return {
        recommendation:
          `Heavy rainfall of ${rain.toFixed(0)} mm recorded. Ensure field drainage channels are clear. Avoid field operations in the next 24–48 hours to prevent soil compaction. Monitor for waterlogging signs, particularly in lower-lying areas of the farm.`,
        reason:
          `Rainfall exceeding 50 mm in a short period can cause surface runoff, soil erosion, and temporary waterlogging. Waterlogged soils deprive roots of oxygen, causing root death within 24–48 hours for most crops in the ${growthStage} stage.`,
        actionTiming: 'Check drainage immediately; delay any tillage or machinery use by at least 48 hours',
        riskAddressed: 'Waterlogging, root anoxia, soil compaction, and erosion',
        environmentalImpact: 'Clear drainage channels prevent waterlogging while protecting soil structure from compaction by heavy machinery',
        riskLevel: 'HIGH',
        dataType: 'rule_based',
      };
    }

    // ── High wind (>15 m/s) ───────────────────────────────────────────────────
    if (wind >= 15) {
      return {
        recommendation:
          `High wind speeds of ${wind.toFixed(0)} m/s (${(wind * 3.6).toFixed(0)} km/h) detected. Delay any spray applications — pesticide/herbicide drift is likely above 5 m/s. Check staking of young plants. Tall crops like maize or sugarcane may require support if lodging risk is elevated.`,
        reason:
          `Wind speeds above 15 m/s create spray drift hazard making applications ineffective and potentially polluting adjacent water bodies or non-target areas. Mechanical damage to standing crops and accelerated soil moisture loss are additional risks.`,
        actionTiming: 'Suspend spray operations until wind drops below 5 m/s',
        riskAddressed: 'Spray drift, off-target pesticide application, crop lodging, and moisture stress',
        environmentalImpact: 'Avoiding spray application in high winds prevents off-target environmental contamination',
        riskLevel: 'MEDIUM',
        dataType: 'rule_based',
      };
    }

    // ── High UV (>8) during sensitive stages ─────────────────────────────────
    if (uv !== undefined && uv >= 8 && ['flowering', 'grain_filling'].includes(growthStage.toLowerCase())) {
      return {
        recommendation:
          `UV index of ${uv.toFixed(0)} is elevated during ${growthStage}. Avoid applying foliar fertilisers or crop protection products during peak UV hours (10 AM – 3 PM) as this increases leaf scorch risk.`,
        reason:
          `High UV index combined with foliar spray applications can cause chemical burns on leaf surfaces, reducing photosynthetic area and potentially reducing grain quality during the critical ${growthStage} period.`,
        actionTiming: 'Schedule foliar applications before 9 AM or after 4 PM',
        riskAddressed: 'Leaf scorch, reduced photosynthesis, and foliar spray phytotoxicity',
        environmentalImpact: 'Timing applications to lower UV periods improves product efficacy and reduces waste',
        riskLevel: 'MEDIUM',
        dataType: 'rule_based',
      };
    }

    return null;
  }
}
