/**
 * Diagnostic Service — orchestrates submission and retrieval.
 *
 * Flow:
 *   1. Validate farmer owns the farm
 *   2. Verify the uploaded image belongs to this user and is not expired
 *   3. Create a PENDING diagnostic record
 *   4. Mark the image as used
 *   5. Enqueue a background job for processing
 *   6. Return the pending diagnostic record immediately (non-blocking)
 *
 * The background job (diagnosticProcessor) updates the record when done.
 * The farmer polls GET /diagnostics/:id to check status.
 */

import { prisma } from '../../db/client.js';
import { enqueueDiagnostic } from '../../queue/index.js';
import { imageUploadService } from './ImageUploadService.js';
import { NotFoundError, AuthorizationError, ImageValidationError } from '../../utils/errors.js';
import { toPrismaSkipTake, paginate } from '../../utils/pagination.js';
import { createLogger } from '../../observability/logger.js';
import { metrics } from '../../observability/metrics.js';
import type { DiagnosticResult, PaginatedResponse } from '@brics-agrin/shared';
import type { PaginationInput } from '../../utils/pagination.js';

const log = createLogger('diagnostic-service');

export interface SubmitDiagnosticInput {
  farmId: string;
  fieldId?: string;
  cropCycleId?: string;
  cropName: string;
  growthStage: string;
  imageId: string;
  notes?: string;
  userId: string;
}

export class DiagnosticService {
  /**
   * Submit a new diagnostic request.
   * Returns the pending record immediately — processing is async.
   */
  async submit(input: SubmitDiagnosticInput): Promise<DiagnosticResult> {
    // ── Authorization ─────────────────────────────────────────────────────────
    await this.assertFarmOwnership(input.farmId, input.userId);

    // ── Validate image ────────────────────────────────────────────────────────
    const image = await prisma.uploadedImage.findUnique({
      where: { id: input.imageId },
      select: {
        id: true,
        storageKey: true,
        fileHash: true,   // Use the already-computed hash from upload time
        uploadedBy: true,
        expiresAt: true,
        isUsed: true,
      },
    });

    if (!image || image.uploadedBy !== input.userId) {
      throw new ImageValidationError('Image not found or access denied');
    }

    if (image.expiresAt < new Date()) {
      throw new ImageValidationError('Image has expired. Please upload a new image.');
    }

    // ── Create diagnostic record ──────────────────────────────────────────────
    const record = await prisma.diseaseDiagnostic.create({
      data: {
        farmId: input.farmId,
        fieldId: input.fieldId ?? null,
        cropCycleId: input.cropCycleId ?? null,
        cropName: input.cropName,
        growthStage: input.growthStage.toUpperCase() as never,
        imageStorageKey: image.storageKey,
        imageHash: image.fileHash, // SHA-256 hash from upload validation — never empty
        status: 'PENDING',
        notes: input.notes ?? null,
      },
    });

    // ── Mark image as used ────────────────────────────────────────────────────
    await imageUploadService.markAsUsed(input.imageId, input.userId);

    // ── Enqueue background job ────────────────────────────────────────────────
    await enqueueDiagnostic({
      diagnosticId: record.id,
      farmId: input.farmId,
      imageStorageKey: image.storageKey,
      cropName: input.cropName,
      growthStage: input.growthStage as never,
      notes: input.notes,
    });

    metrics.diagnosticRequested.increment();

    log.info({ diagnosticId: record.id, farmId: input.farmId }, 'Diagnostic submitted');

    return this.toDiagnosticResultDto(record);
  }

  /**
   * Get a diagnostic result by ID (includes processing status).
   */
  async getById(id: string, userId: string): Promise<DiagnosticResult> {
    const record = await prisma.diseaseDiagnostic.findUnique({ where: { id } });

    if (!record) throw new NotFoundError('DiagnosticResult', id);

    await this.assertFarmOwnership(record.farmId, userId);

    return this.toDiagnosticResultDto(record);
  }

  /**
   * List all diagnostics for a farm with pagination.
   */
  async listForFarm(
    farmId: string,
    userId: string,
    pagination: PaginationInput,
  ): Promise<PaginatedResponse<DiagnosticResult>> {
    await this.assertFarmOwnership(farmId, userId);

    const { skip, take } = toPrismaSkipTake(pagination);

    const [records, total] = await Promise.all([
      prisma.diseaseDiagnostic.findMany({
        where: { farmId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.diseaseDiagnostic.count({ where: { farmId } }),
    ]);

    return paginate(records.map((r) => this.toDiagnosticResultDto(r)), total, pagination);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async assertFarmOwnership(farmId: string, userId: string): Promise<void> {
    const farm = await prisma.farm.findFirst({
      where: { id: farmId, deletedAt: null, farmerProfile: { userId } },
      select: { id: true },
    });
    if (!farm) throw new AuthorizationError('Farm not found or access denied');
  }

  private toDiagnosticResultDto(record: {
    id: string;
    farmId: string;
    fieldId?: string | null;
    cropName: string;
    growthStage: string;
    status: string;
    conditionsJson?: unknown;
    topConditionName?: string | null;
    topConditionConfidence?: unknown;
    overallConfidence?: unknown;
    modelVersion?: string | null;
    safeNextStepsJson?: unknown;
    requiresExpertConsult: boolean;
    diagnosedAt?: Date | null;
    createdAt: Date;
  }): DiagnosticResult {
    const conditions = Array.isArray(record.conditionsJson)
      ? (record.conditionsJson as DiagnosticResult['conditions'])
      : [];

    const topCondition =
      record.topConditionName && record.topConditionConfidence !== null
        ? conditions.find((c) => c.name === record.topConditionName) ?? null
        : null;

    return {
      id: record.id,
      farmId: record.farmId,
      cropName: record.cropName,
      growthStage: record.growthStage as DiagnosticResult['growthStage'],
      status: record.status as DiagnosticResult['status'],
      conditions,
      topCondition: topCondition ?? undefined,
      confidence: record.overallConfidence ? Number(record.overallConfidence) : 0,
      modelVersion: record.modelVersion ?? 'unknown',
      diagnosedAt: record.diagnosedAt?.toISOString() ?? record.createdAt.toISOString(),
      safeNextSteps: Array.isArray(record.safeNextStepsJson)
        ? (record.safeNextStepsJson as string[])
        : [],
      requiresExpertConsultation: record.requiresExpertConsult,
      disclaimer: this.buildStatusDisclaimer(record.status),
    };
  }

  private buildStatusDisclaimer(status: string): string {
    switch (status) {
      case 'PENDING':
        return 'Analysis is pending. Results will be available shortly.';
      case 'PROCESSING':
        return 'Analysis is currently in progress.';
      case 'LOW_CONFIDENCE':
        return 'Automated analysis could not reach sufficient confidence. Expert consultation is required.';
      case 'INCONCLUSIVE':
        return 'Multiple conditions were detected with similar probability. This result is inconclusive and requires expert verification.';
      case 'FAILED':
        return 'Automated analysis failed. Please consult a local agricultural extension officer.';
      default:
        return 'This is an automated screening result and must be verified by a qualified agronomist before any treatments are applied.';
    }
  }
}

export const diagnosticService = new DiagnosticService();
