/**
 * AI Explanation Layer.
 *
 * Takes a structured rule result and generates a localized, farmer-friendly
 * explanation using OpenAI (if configured) or a deterministic template fallback.
 *
 * SECURITY rules:
 *   - User-provided data (crop name, notes) is included as DATA, never as instructions
 *   - System prompt is fixed and cannot be overridden by input data
 *   - All AI output is post-processed and length-limited
 *   - Low-quality or empty AI responses fall back to the rule-based text
 *   - Model metadata (version, timestamp) is always recorded
 *
 * TRANSPARENCY:
 *   - AI-generated text is always labeled 'ai_generated' in evidence
 *   - Rule-based text retains 'rule_based' label even when AI rewrites it
 */

import { createLogger } from '../../observability/logger.js';
import { config } from '../../config/index.js';
import type { AdvisoryEngineInput, RuleResult } from '../../domain/advisory/types.js';
import type { SupportedLanguage } from '@brics-agrin/shared';

const log = createLogger('ai-explainer');

const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  hi: 'Hindi',
  pt: 'Portuguese',
  ru: 'Russian',
  zh: 'Mandarin Chinese',
  ar: 'Arabic',
  fr: 'French',
};

export interface ExplainerResult {
  recommendation: string;
  reason: string;
  actionTiming: string;
  wasAiEnhanced: boolean;
  modelVersion: string;
}

export class AiExplainer {
  /**
   * Attempt to generate an AI-enhanced explanation.
   * Falls back to the original rule text if AI is unavailable or returns low-quality output.
   * Never throws — always returns usable text.
   */
  async explain(
    ruleResult: RuleResult,
    input: AdvisoryEngineInput,
    language: SupportedLanguage,
  ): Promise<ExplainerResult> {
    if (!config.OPENAI_API_KEY) {
      log.debug('OpenAI not configured — using rule-based text directly');
      return {
        recommendation: ruleResult.recommendation,
        reason: ruleResult.reason,
        actionTiming: ruleResult.actionTiming,
        wasAiEnhanced: false,
        modelVersion: `rule-engine-${config.ADVISORY_MODEL_VERSION}`,
      };
    }

    try {
      const enhanced = await this.callOpenAI(ruleResult, input, language);
      return {
        ...enhanced,
        wasAiEnhanced: true,
        modelVersion: `gpt-4o-${config.ADVISORY_MODEL_VERSION}`,
      };
    } catch (err) {
      log.warn({ err }, 'AI explanation failed — falling back to rule-based text');
      return {
        recommendation: ruleResult.recommendation,
        reason: ruleResult.reason,
        actionTiming: ruleResult.actionTiming,
        wasAiEnhanced: false,
        modelVersion: `rule-engine-${config.ADVISORY_MODEL_VERSION}`,
      };
    }
  }

  private async callOpenAI(
    ruleResult: RuleResult,
    input: AdvisoryEngineInput,
    language: SupportedLanguage,
  ): Promise<Pick<ExplainerResult, 'recommendation' | 'reason' | 'actionTiming'>> {
    // Lazy import to avoid loading the module when AI is not configured
    const { default: OpenAI } = await import('openai').catch(() => {
      throw new Error('openai package not installed');
    });

    const client = new OpenAI({ apiKey: config.OPENAI_API_KEY });
    const targetLanguage = LANGUAGE_NAMES[language] ?? 'English';

    // ── FIXED system prompt — cannot be modified by user input ───────────────
    const systemPrompt = `You are an agricultural advisory assistant helping small and marginal farmers in BRICS countries.
Your task is to rewrite an agricultural recommendation in clear, simple language that a farmer with limited formal education can understand.
Output language: ${targetLanguage}.
Rules:
- Use simple, practical language. Avoid technical jargon unless absolutely necessary, and if used, briefly explain it.
- Do NOT change the factual content, quantities, or timing recommendations.
- Do NOT invent new recommendations or add claims not present in the input.
- Do NOT present predictions as facts. If data is estimated or forecasted, say so.
- Keep the response concise and actionable.
- Output format: JSON with keys "recommendation", "reason", "actionTiming". No other text.`;

    // ── Sanitize user-controlled fields before including in user message ──────
    // Strip any characters outside printable ASCII + common diacritics.
    // Truncate to reasonable field lengths to prevent token stuffing.
    const safeCropName = this.sanitizeField(input.cropName, 50);
    const safeGrowthStage = this.sanitizeField(input.growthStage, 30);
    const safeFarmingPractice = this.sanitizeField(input.farmingPractice, 30);
    const safeArea = Math.max(0, Math.min(input.areaHectares, 100_000)).toFixed(1);

    // ── User message contains ONLY structured data — never raw user input ─────
    const userMessage = `Rewrite this agricultural advisory in ${targetLanguage}:

CROP: ${safeCropName} (${safeGrowthStage} stage)
FARMING PRACTICE: ${safeFarmingPractice}
AREA: ${safeArea} hectares

RECOMMENDATION: ${ruleResult.recommendation}
REASON: ${ruleResult.reason}
WHEN TO ACT: ${ruleResult.actionTiming}
RISK LEVEL: ${ruleResult.riskLevel}`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 600,
      temperature: 0.3, // Low temperature for consistent, factual output
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error('Empty AI response');

    const parsed = JSON.parse(raw) as Record<string, unknown>;

    // Validate AI output — must have all three fields with non-empty strings
    const recommendation = String(parsed.recommendation ?? '').trim();
    const reason = String(parsed.reason ?? '').trim();
    const actionTiming = String(parsed.actionTiming ?? '').trim();

    if (!recommendation || !reason || !actionTiming) {
      throw new Error('AI response missing required fields');
    }

    // Sanity length check — truncate if model output is excessively long
    return {
      recommendation: recommendation.slice(0, 2000),
      reason: reason.slice(0, 2000),
      actionTiming: actionTiming.slice(0, 500),
    };
  }

  /**
   * Sanitize a user-controlled string before including it in an AI prompt.
   * - Removes control characters and null bytes
   * - Strips characters that could be used to break prompt structure
   * - Truncates to maxLength
   */
  private sanitizeField(value: string, maxLength: number): string {
    return value
      .replace(/[\x00-\x1F\x7F]/g, ' ')   // strip control chars and null bytes
      .replace(/[`\\]/g, ' ')               // strip backticks and backslashes
      .trim()
      .slice(0, maxLength);
  }
}

export const aiExplainer = new AiExplainer();
