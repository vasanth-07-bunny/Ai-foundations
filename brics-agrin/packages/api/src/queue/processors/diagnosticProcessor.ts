/**
 * Background processor for crop disease diagnostics.
 *
 * Called by Bull for each job dequeued from the 'diagnostic' queue.
 * Fetches the image from object storage, runs the full diagnostic
 * pipeline, and persists the result to the database.
 */

import type Bull from 'bull';
import { prisma } from '../../db/client.js';
import { createLogger } from '../../observability/logger.js';
import { metrics } from '../../observability/metrics.js';
import type { DiagnosticJobPayload } from '../../domain/diagnostic/types.js';
import { DiagnosticPipelineService } from '../../services/diagnostic/DiagnosticPipelineService.js';
import { StubModelProvider } from '../../services/diagnostic/providers/StubModelProvider.js';

const log = createLogger('diagnostic-processor');
// Use stub provider by default; swap to a real ML provider in production
const modelProvider = new StubModelProvider();
const pipeline = new DiagnosticPipelineService(modelProvider);

export async function processDiagnosticJob(
  job: Bull.Job<DiagnosticJobPayload>,
): Promise<void> {
  const { diagnosticId, imageStorageKey, cropName, growthStage } = job.data;
  const start = Date.now();

  log.info({ diagnosticId, jobId: job.id }, 'Processing diagnostic job');

  // Mark as processing
  await prisma.diseaseDiagnostic.update({
    where: { id: diagnosticId },
    data: { status: 'PROCESSING', updatedAt: new Date() },
  });

  try {
    // In a full deployment this would fetch from object storage.
    // For now, the pipeline accepts a storage key and resolves it internally.
    const result = await pipeline.runFromStorageKey(
      imageStorageKey,
      cropName,
      growthStage,
    );

    await prisma.diseaseDiagnostic.update({
      where: { id: diagnosticId },
      data: {
        status: result.status,
        conditionsJson: result.conditions as unknown as object[],
        topConditionName: result.topCondition?.name ?? null,
        topConditionConfidence: result.topCondition?.confidence ?? null,
        overallConfidence: result.overallConfidence,
        modelVersion: result.modelVersion,
        safeNextStepsJson: result.safeNextSteps as unknown as string[],
        requiresExpertConsult: result.requiresExpertConsultation,
        diagnosedAt: result.diagnosedAt,
        updatedAt: new Date(),
      },
    });

    metrics.diagnosticLatency.observe(Date.now() - start);
    log.info({ diagnosticId, status: result.status }, 'Diagnostic complete');
  } catch (err) {
    log.error({ err, diagnosticId }, 'Diagnostic processing failed');

    await prisma.diseaseDiagnostic.update({
      where: { id: diagnosticId },
      data: { status: 'FAILED', updatedAt: new Date() },
    });

    throw err; // Re-throw so Bull records the failure and can retry
  }
}
