/**
 * Soil Health & Regenerative Agriculture Rule.
 *
 * Evaluates soil observations and recommends:
 *   - Organic matter improvement (cover crops, compost)
 *   - pH correction
 *   - Nutrient management
 *   - Reduced tillage where appropriate
 *   - Crop rotation suggestions
 *
 * Regenerative recommendations are context-aware, not generic.
 */

import { BaseRule } from './BaseRule.js';
import type { AdvisoryEngineInput, RuleResult } from '../../../domain/advisory/types.js';

// Optimal ranges for common soil parameters
const SOIL_RANGES = {
  PH: { low: 5.5, high: 7.5, optimal_low: 6.0, optimal_high: 7.0 },
  ORGANIC_CARBON_PERCENT: { critical: 0.5, low: 0.75, good: 1.5 },
  NITROGEN_KG_HA: { critical: 20, low: 40, adequate: 80 },
  MOISTURE_PERCENT: { low: 25, adequate: 40, high: 70 },
} as const;

export class SoilHealthRule extends BaseRule {
  readonly id = 'soil-health-v1';
  readonly category = 'SOIL_HEALTH' as const;
  readonly description = 'Soil health assessment and regenerative agriculture recommendations';

  evaluate(input: AdvisoryEngineInput): RuleResult | null {
    const { soil, farmingPractice, cropName } = input;

    if (!soil) return null;

    // ── pH check ─────────────────────────────────────────────────────────────
    if (soil.phLevel !== undefined) {
      const ph = soil.phLevel;
      if (ph < SOIL_RANGES.PH.low) {
        return {
          recommendation:
            `Soil pH of ${ph.toFixed(1)} is strongly acidic. Apply agricultural lime at approximately ${this.limeRateKgHa(ph)} kg/ha. Consider split application over two seasons. ${farmingPractice === 'ORGANIC' ? 'Use calcitic or dolomitic lime for organic compliance.' : ''}`,
          reason:
            `Soil pH below ${SOIL_RANGES.PH.low} significantly reduces nutrient availability (particularly phosphorus and molybdenum) and can increase toxic aluminium and manganese concentrations, directly reducing crop yields for ${cropName}.`,
          actionTiming: 'Apply 4–6 weeks before next planting season to allow pH adjustment time',
          riskAddressed: 'Nutrient lockout, aluminium toxicity, and reduced crop productivity',
          environmentalImpact: 'Correcting soil pH improves fertiliser efficiency, potentially reducing total nutrient inputs required',
          riskLevel: 'HIGH',
          dataType: 'rule_based',
        };
      }
      if (ph > SOIL_RANGES.PH.high) {
        return {
          recommendation:
            `Soil pH of ${ph.toFixed(1)} is alkaline. Apply elemental sulphur or acidifying fertilisers. Avoid alkaline irrigation water where possible.`,
          reason:
            `Alkaline pH above ${SOIL_RANGES.PH.high} reduces availability of iron, manganese, zinc, and boron. This commonly causes micronutrient deficiencies in ${cropName}.`,
          actionTiming: 'Incorporate soil amendment before next tillage operation',
          riskAddressed: 'Micronutrient deficiency and reduced nutrient uptake efficiency',
          environmentalImpact: 'Acidification with sulphur is a targeted intervention with minimal runoff risk when applied correctly',
          riskLevel: 'MEDIUM',
          dataType: 'rule_based',
        };
      }
    }

    // ── Organic carbon check ──────────────────────────────────────────────────
    if (soil.organicCarbonPercent !== undefined) {
      const oc = soil.organicCarbonPercent;
      if (oc < SOIL_RANGES.ORGANIC_CARBON_PERCENT.critical) {
        return {
          recommendation:
            `Soil organic carbon is critically low at ${oc.toFixed(2)}%. Immediately incorporate organic matter: apply 5–10 tonnes/ha of composted manure or crop residues. Plant a cover crop between seasons (e.g. leguminous green manure) to restore soil biology.`,
          reason:
            `Organic carbon below ${SOIL_RANGES.ORGANIC_CARBON_PERCENT.critical}% indicates severely degraded soil structure, poor water-holding capacity, and insufficient microbial activity. This is a long-term threat to farm productivity and climate resilience.`,
          actionTiming: 'Begin cover cropping at the end of this harvest season; apply compost before next planting',
          riskAddressed: 'Soil degradation, reduced water retention, carbon loss, and declining long-term productivity',
          environmentalImpact: 'Increasing soil organic carbon sequesters atmospheric carbon and significantly reduces dependence on synthetic fertilisers',
          riskLevel: 'HIGH',
          dataType: 'rule_based',
        };
      }

      if (oc < SOIL_RANGES.ORGANIC_CARBON_PERCENT.low) {
        return {
          recommendation:
            `Soil organic carbon is below optimal at ${oc.toFixed(2)}%. Consider adding 2–3 tonnes/ha of compost, rotating with a leguminous crop in the next season, and reducing tillage intensity where possible.`,
          reason:
            `Organic carbon below ${SOIL_RANGES.ORGANIC_CARBON_PERCENT.low}% limits soil biological activity, nutrient cycling, and water retention. Gradual improvement through regenerative practices will reduce input costs over time.`,
          actionTiming: 'Implement cover cropping and compost application over the next 1–2 seasons',
          riskAddressed: 'Declining soil fertility, reduced water holding capacity, and increased erosion risk',
          environmentalImpact: 'Regenerative organic matter addition improves carbon sequestration and reduces need for synthetic fertilisers',
          riskLevel: 'MEDIUM',
          dataType: 'rule_based',
        };
      }
    }

    // ── Nitrogen check ────────────────────────────────────────────────────────
    if (soil.nitrogenKgPerHa !== undefined) {
      const n = soil.nitrogenKgPerHa;
      if (n < SOIL_RANGES.NITROGEN_KG_HA.critical) {
        return {
          recommendation:
            `Available nitrogen is critically low at ${n.toFixed(0)} kg/ha. Apply a split nitrogen dose: ${farmingPractice === 'ORGANIC' ? 'use approved organic nitrogen sources such as blood meal, fish meal, or well-composted poultry manure at basal dose, followed by liquid organic fertiliser at top-dressing' : 'apply basal dose of 40 kg N/ha at planting, followed by top-dressing at the active growth stage'}.`,
          reason:
            `Available nitrogen below ${SOIL_RANGES.NITROGEN_KG_HA.critical} kg/ha is insufficient for productive growth of ${cropName}. Nitrogen is essential for chlorophyll synthesis, protein formation, and vegetative growth.`,
          actionTiming: 'Apply basal dose at planting; top-dressing at active vegetative stage',
          riskAddressed: 'Nitrogen deficiency, stunted growth, and significantly reduced yield',
          environmentalImpact: 'Split application improves nitrogen use efficiency and reduces leaching compared to single-dose application',
          riskLevel: 'HIGH',
          dataType: 'rule_based',
        };
      }
    }

    return null;
  }

  private limeRateKgHa(currentPh: number): number {
    // Approximate lime requirement: more acidic = more lime needed
    const deficit = 6.5 - currentPh;
    return Math.round(deficit * 1000); // ~1000 kg/ha per pH unit (generalised)
  }
}
