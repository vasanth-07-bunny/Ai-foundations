/**
 * Base class for all agricultural rules.
 *
 * Rules are DETERMINISTIC — no AI inference inside a rule.
 * They encode expert agricultural knowledge as testable logic.
 * AI is used only to generate the human-readable explanation afterward.
 *
 * Every rule must:
 *   - Have a stable, unique ID
 *   - Evaluate against the full engine input
 *   - Return a structured RuleResult or null (no match)
 *   - Never throw — return null on unexpected data
 */

import type { AgriculturalRule, RuleResult } from '../../../domain/advisory/types.js';
import type { AdvisoryEngineInput } from '../../../domain/advisory/types.js';
import type { AdvisoryCategory } from '@prisma/client';

export abstract class BaseRule implements AgriculturalRule {
  abstract readonly id: string;
  abstract readonly category: AdvisoryCategory;
  abstract readonly description: string;

  abstract evaluate(input: AdvisoryEngineInput): RuleResult | null;

  /** Helper: clamp a number to [0, 1] for confidence values */
  protected clamp(value: number, min = 0, max = 1): number {
    return Math.min(Math.max(value, min), max);
  }
}
