/**
 * Regenerative Agriculture Rule.
 *
 * Recommends regenerative practices based on:
 *   - Current farming practice
 *   - Crop growth stage (harvest = ideal time for cover crops)
 *   - Soil health status
 *   - Satellite-derived vegetation index (NDVI)
 *
 * Recommendations are practical and timed to the crop cycle —
 * not generic environmental messaging.
 */

import { BaseRule } from './BaseRule.js';
import type { AdvisoryEngineInput, RuleResult } from '../../../domain/advisory/types.js';

export class RegenerativeRule extends BaseRule {
  readonly id = 'regenerative-v1';
  readonly category = 'REGENERATIVE_PRACTICE' as const;
  readonly description = 'Context-aware regenerative agriculture practice recommendations';

  evaluate(input: AdvisoryEngineInput): RuleResult | null {
    const { growthStage, farmingPractice, satellite, soil, cropName, areaHectares } = input;

    // ── Post-harvest: cover cropping opportunity ──────────────────────────────
    if (['harvest', 'maturity'].includes(growthStage.toLowerCase())) {
      const isAlreadyRegenerative = ['REGENERATIVE', 'ORGANIC', 'ZERO_TILLAGE'].includes(
        farmingPractice,
      );

      if (!isAlreadyRegenerative) {
        return {
          recommendation:
            `This is an ideal time to plant a cover crop before the next main crop. For a ${areaHectares.toFixed(1)} ha farm, consider: (1) Leguminous cover (cowpea, sunn hemp, or clover) to fix atmospheric nitrogen — reduces next season's fertiliser requirement by 30–50 kg N/ha. (2) Cereals mixed with legumes for maximum biomass and soil coverage. Terminate the cover crop 3–4 weeks before planting main crop.`,
          reason:
            `Post-harvest is the optimal window for cover cropping. The current ${farmingPractice.toLowerCase()} practice leaves soil bare between seasons, which accelerates erosion, moisture loss, and organic matter oxidation. Cover cropping can increase soil organic carbon by 0.1–0.3% per season.`,
          actionTiming: 'Plant within 1–2 weeks of harvest to maximise the growing window before next season',
          riskAddressed: 'Soil erosion, organic matter decline, bare-soil moisture loss, and high nitrogen fertiliser dependency',
          environmentalImpact:
            'Cover cropping sequesters carbon, fixes nitrogen biologically, improves soil water retention by 10–20%, and supports soil biodiversity',
          riskLevel: 'LOW',
          dataType: 'rule_based',
        };
      }
    }

    // ── Low NDVI: vegetation stress intervention ──────────────────────────────
    if (satellite?.ndvi !== undefined && satellite.ndvi < 0.3) {
      const ndvi = satellite.ndvi;
      return {
        recommendation:
          `Satellite data shows low vegetation index (NDVI: ${ndvi.toFixed(2)}) for the current ${growthStage} stage of ${cropName}. This may indicate nutrient stress, water stress, or pest/disease pressure. Conduct a physical field inspection to diagnose the cause. Check: (1) Leaf colour (yellowing = N deficiency; purple = P deficiency). (2) Soil moisture at 15 cm depth. (3) Presence of any pest or disease symptoms.`,
        reason:
          `NDVI below 0.3 during the ${growthStage} stage is significantly lower than expected for a healthy ${cropName} crop. Normal NDVI for this stage should be 0.5–0.8. Low NDVI indicates reduced photosynthetic activity, which will negatively impact final yield if not addressed.`,
        actionTiming: 'Inspect field within 24–48 hours',
        riskAddressed: 'Undiagnosed stress causing yield loss — early intervention is significantly more effective than late correction',
        environmentalImpact: 'Early, targeted diagnosis prevents blanket application of inputs, reducing environmental footprint',
        riskLevel: 'MEDIUM',
        dataType: 'model_derived',
      };
    }

    // ── Crop rotation recommendation (based on crop type) ────────────────────
    if (['harvest', 'maturity'].includes(growthStage.toLowerCase())) {
      const rotationSuggestion = this.getCropRotationSuggestion(cropName);
      if (rotationSuggestion) {
        return {
          recommendation: rotationSuggestion,
          reason:
            `Monoculture farming increases soil-borne disease pressure, pest buildup, and nutrient depletion over time. Crop rotation breaks pest and disease cycles, improves soil nutrient balance, and can reduce input costs in subsequent seasons.`,
          actionTiming: 'Plan rotation crop before committing to next season inputs',
          riskAddressed: 'Soil-borne disease buildup, pest escalation, and nutrient depletion',
          environmentalImpact:
            'Crop rotation reduces reliance on pesticides and fertilisers by exploiting natural nutrient cycling and pest management',
          riskLevel: 'LOW',
          dataType: 'rule_based',
        };
      }
    }

    return null;
  }

  private getCropRotationSuggestion(cropName: string): string | null {
    const name = cropName.toLowerCase();
    const rotationMap: Record<string, string> = {
      wheat: 'Consider rotating wheat with a leguminous crop (soybean, lentils, or chickpea) next season to naturally replenish soil nitrogen depleted by wheat production.',
      rice: 'Consider rotating rice with vegetables, pulses, or a short-duration leguminous crop to break rice blast disease cycles and improve soil health.',
      maize: 'Consider rotating maize with soybean or another legume to restore nitrogen and reduce corn rootworm pressure naturally.',
      cotton: 'Rotate cotton with a cereal crop (wheat, maize, or sorghum) to break the build-up of cotton-specific soil pathogens and bollworm populations.',
      sugarcane: 'Where possible, plan a ratoon management strategy; after 3–4 ratoon cycles, replant and consider one season of a leguminous green manure crop.',
      soybean: 'Rotate soybean with a non-legume cereal (maize, wheat, or sorghum) to prevent build-up of root rot pathogens and nematodes.',
    };

    for (const [key, suggestion] of Object.entries(rotationMap)) {
      if (name.includes(key)) return suggestion;
    }
    return null;
  }
}
