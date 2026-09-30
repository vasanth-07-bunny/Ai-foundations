/**
 * Health and readiness endpoints.
 *
 * /health/live   — liveness probe (is the process alive?)
 * /health/ready  — readiness probe (can it serve traffic? DB + cache up?)
 * /health/metrics — internal metrics summary (non-production)
 *
 * These must NEVER require authentication — they are called by
 * load balancers and container orchestrators.
 */

import { Router, type Request, type Response } from 'express';
import { prisma } from '../db/client.js';
import { redisClient } from '../cache/client.js';
import { getMetricsSummary } from '../observability/metrics.js';
import { config } from '../config/index.js';
import { createLogger } from '../observability/logger.js';

const log = createLogger('health');
export const healthRouter = Router();

// ── Liveness ──────────────────────────────────────────────────────────────────

healthRouter.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Readiness ─────────────────────────────────────────────────────────────────

healthRouter.get('/ready', async (_req: Request, res: Response) => {
  const checks: Record<string, { status: string; latencyMs?: number }> = {};

  // Database check
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'ok', latencyMs: Date.now() - dbStart };
  } catch (err) {
    log.error({ err }, 'Health check: database failed');
    checks.database = { status: 'error' };
  }

  // Cache check
  const cacheStart = Date.now();
  try {
    await redisClient.ping();
    checks.cache = { status: 'ok', latencyMs: Date.now() - cacheStart };
  } catch (err) {
    log.error({ err }, 'Health check: cache failed');
    checks.cache = { status: 'error' };
  }

  const allHealthy = Object.values(checks).every((c) => c.status === 'ok');
  const httpStatus = allHealthy ? 200 : 503;

  res.status(httpStatus).json({
    status: allHealthy ? 'ready' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
});

// ── Metrics (non-production only) ─────────────────────────────────────────────

healthRouter.get('/metrics', (_req: Request, res: Response) => {
  if (config.IS_PRODUCTION) {
    res.status(404).json({ message: 'Not available in production' });
    return;
  }
  res.status(200).json(getMetricsSummary());
});
