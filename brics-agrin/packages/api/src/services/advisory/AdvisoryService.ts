/**
 * Advisory Service — orchestrates the full generate-and-persist workflow.
 *
 * Responsibilities:
 *   - Check cache before running the engine
 *   - Call the advisory engine
 *   - Persist the result to the database
 *   - Cache the result for subsequent requests
 *   - Return serialized advisory DTOs for the API layer
 *   - List historical advisories for a farm
 */

import { prisma } from '../../db/client.js';
import { advisoryEngine } from './AdvisoryEngine.js';
import { cacheGet, cacheSet, CacheKeys } from '../../cache/client.js';
import { config } from '../../config/index.js';
import { createLogger } from '../../observability/logger.js';
import { metrics } from '../../observability/metrics.js';
import { NotFoundError, AuthorizationError } from '../../utils/errors.js';
import { toPrismaSkipTake, paginate } from '../../utils/pagination.js';
import type { Advisory, PaginatedResponse, SupportedLanguage } from '@brics-agrin/shared';
import type { GenerateAdvisoryInput } from './AdvisoryEngine.js';
import type { PaginationInput } from '../../utils/pagination.js';

const log = createLogger('advisory-service');

export class AdvisoryService {
  /**
   * Generate (or retrieve cached) advisory for a farm's active crop cycle.
   */
  async generateForFarm(
    input: GenerateAdvisoryInput,
    requestingUserId: string,
  ): Promise<Advisory | null> {
    // ── Authorization: verify the farm belongs to this user ───────────────────
    await this.assertFarmOwnership(input.farmId, requestingUserId);

    // ── Cache check ───────────────────────────────────────────────────────────
    const today = new Date().toISOString().split('T')[0] ?? '';
    const cacheKey = CacheKeys.advisory(
      input.farmId,
      input.cropCycleId ?? 'none',
      today,
      input.language,
    );

    const cached = await cacheGet<Advisory>(cacheKey);
    if (cached) {
      metrics.advisoryCacheHit.increment();
      log.debug({ farmId: input.farmId }, 'Advisory cache hit');
      return cached;
    }

    // ── Generate new advisory ─────────────────────────────────────────────────
    const engineOutput = await advisoryEngine.generate(input);

    if (!engineOutput) {
      log.info({ farmId: input.farmId }, 'No advisory generated for current conditions');
      return null;
    }

    // ── Persist to database ───────────────────────────────────────────────────
    const record = await prisma.advisory.create({
      data: {
        farmId: input.farmId,
        cropCycleId: input.cropCycleId ?? null,
        category: engineOutput.category,
        recommendation: engineOutput.recommendation,
        reason: engineOutput.reason,
        actionTiming: engineOutput.actionTiming,
        riskAddressed: engineOutput.riskAddressed,
        envImpact: engineOutput.environmentalImpact,
        confidence: engineOutput.confidence,
        riskLevel: engineOutput.riskLevel,
        language: input.language,
        modelVersion: engineOutput.modelVersion,
        evidenceJson: engineOutput.evidence as object,
        generatedAt: engineOutput.generatedAt,
        expiresAt: engineOutput.expiresAt,
      },
    });

    metrics.advisoryGenerated.increment();

    const advisory = this.toAdvisoryDto(record, engineOutput.evidence as Advisory['evidence']);

    // ── Cache the result ──────────────────────────────────────────────────────
    await cacheSet(cacheKey, advisory, config.ADVISORY_CACHE_TTL_SECONDS);

    return advisory;
  }

  /**
   * List all historical advisories for a farm with pagination.
   */
  async listForFarm(
    farmId: string,
    requestingUserId: string,
    pagination: PaginationInput,
    language?: SupportedLanguage,
  ): Promise<PaginatedResponse<Advisory>> {
    await this.assertFarmOwnership(farmId, requestingUserId);

    const where = {
      farmId,
      ...(language ? { language } : {}),
    };

    const { skip, take } = toPrismaSkipTake(pagination);

    const [records, total] = await Promise.all([
      prisma.advisory.findMany({
        where,
        orderBy: { generatedAt: 'desc' },
        skip,
        take,
      }),
      prisma.advisory.count({ where }),
    ]);

    const advisories = records.map((r) =>
      this.toAdvisoryDto(r, r.evidenceJson as Advisory['evidence']),
    );

    return paginate(advisories, total, pagination);
  }

  /**
   * Get a single advisory by ID.
   */
  async getById(id: string, requestingUserId: string): Promise<Advisory> {
    const record = await prisma.advisory.findUnique({ where: { id } });

    if (!record) throw new NotFoundError('Advisory', id);

    // Authorization: verify through farm ownership
    await this.assertFarmOwnership(record.farmId, requestingUserId);

    return this.toAdvisoryDto(record, record.evidenceJson as Advisory['evidence']);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async assertFarmOwnership(farmId: string, userId: string): Promise<void> {
    const farm = await prisma.farm.findFirst({
      where: {
        id: farmId,
        deletedAt: null,
        farmerProfile: { userId },
      },
      select: { id: true },
    });

    if (!farm) {
      throw new AuthorizationError('Farm not found or access denied');
    }
  }

  private toAdvisoryDto(
    record: {
      id: string;
      farmId: string;
      cropCycleId: string | null;
      category: string;
      recommendation: string;
      reason: string;
      actionTiming: string;
      riskAddressed: string;
      envImpact: string;
      confidence: unknown;
      riskLevel: string;
      language: string;
      modelVersion: string;
      generatedAt: Date;
      expiresAt: Date;
    },
    evidence: Advisory['evidence'],
  ): Advisory {
    return {
      id: record.id,
      farmId: record.farmId,
      cropCycleId: record.cropCycleId ?? undefined,
      category: record.category as Advisory['category'],
      recommendation: record.recommendation,
      reason: record.reason,
      actionTiming: record.actionTiming,
      riskAddressed: record.riskAddressed,
      environmentalImpact: record.envImpact,
      confidence: Number(record.confidence),
      riskLevel: record.riskLevel as Advisory['riskLevel'],
      language: record.language as Advisory['language'],
      modelVersion: record.modelVersion,
      evidence,
      generatedAt: record.generatedAt.toISOString(),
      expiresAt: record.expiresAt.toISOString(),
    };
  }
}

export const advisoryService = new AdvisoryService();
