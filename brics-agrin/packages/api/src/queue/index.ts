/**
 * Bull job queue — initialises all queues and registers processors.
 *
 * Expensive operations (satellite fetch, ML inference, advisory generation)
 * are processed off the request path to keep API latency low.
 *
 * Queue names and job type constants live here so they are never
 * duplicated across the codebase.
 */

import Bull from 'bull';
import { config } from '../config/index.js';
import { createLogger } from '../observability/logger.js';
import type { DiagnosticJobPayload } from '../domain/diagnostic/types.js';

const log = createLogger('queue');

// ─── Queue instances ──────────────────────────────────────────────────────────

const QUEUE_OPTIONS: Bull.QueueOptions = {
  redis: config.REDIS_URL,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
};

export const diagnosticQueue = new Bull<DiagnosticJobPayload>(
  'diagnostic',
  QUEUE_OPTIONS,
);

export const advisoryQueue = new Bull<{ farmId: string; cropCycleId: string }>(
  'advisory',
  QUEUE_OPTIONS,
);

// ─── Queue event logging ──────────────────────────────────────────────────────

function attachQueueEvents(queue: Bull.Queue, name: string): void {
  queue.on('completed', (job) =>
    log.info({ queue: name, jobId: job.id }, 'Job completed'),
  );
  queue.on('failed', (job, err) =>
    log.error({ queue: name, jobId: job.id, err }, 'Job failed'),
  );
  queue.on('stalled', (job) =>
    log.warn({ queue: name, jobId: job.id }, 'Job stalled'),
  );
  queue.on('error', (err) =>
    log.error({ queue: name, err }, 'Queue error'),
  );
}

// ─── Processor registration ───────────────────────────────────────────────────

export async function initializeQueue(): Promise<void> {
  attachQueueEvents(diagnosticQueue, 'diagnostic');
  attachQueueEvents(advisoryQueue, 'advisory');

  // Processors are imported lazily to avoid circular dependency issues
  const { processDiagnosticJob } = await import('./processors/diagnosticProcessor.js');
  diagnosticQueue.process(1, processDiagnosticJob);

  log.info('All queues initialized');
}

/** Add a diagnostic job and return the job ID */
export async function enqueueDiagnostic(
  payload: DiagnosticJobPayload,
): Promise<string> {
  const job = await diagnosticQueue.add(payload, {
    jobId: `diag-${payload.diagnosticId}`,
    // Prevent duplicate jobs for the same diagnostic
    removeOnComplete: true,
  });
  return String(job.id);
}
