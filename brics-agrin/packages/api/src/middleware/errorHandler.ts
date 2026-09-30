/**
 * Global error handler middleware.
 *
 * Converts any thrown error into a consistent API response.
 * NEVER leaks stack traces, DB errors, or internal details to the client.
 * All errors are logged with their request ID for correlation.
 */

import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { isAppError, ValidationError } from '../utils/errors.js';
import { createLogger } from '../observability/logger.js';
import { metrics } from '../observability/metrics.js';

const log = createLogger('error-handler');

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  const requestId = req.id ?? 'unknown';

  // ── Zod validation errors (from middleware or services) ───────────────────
  if (err instanceof ZodError) {
    const details: Record<string, string> = {};
    err.issues.forEach((issue) => {
      details[issue.path.join('.')] = issue.message;
    });

    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details,
      },
      requestId,
    });
    return;
  }

  // ── Known operational errors ───────────────────────────────────────────────
  if (isAppError(err)) {
    if (!err.isOperational) {
      log.error({ err, requestId }, 'Non-operational error');
    } else if (err.statusCode >= 500) {
      log.error({ err, requestId }, 'Server error');
    } else {
      log.warn({ err: err.message, code: err.code, requestId }, 'Client error');
    }

    metrics.httpErrors.increment({ code: String(err.statusCode) });

    const body: Record<string, unknown> = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
      requestId,
    };

    if (err instanceof ValidationError && Object.keys(err.details).length > 0) {
      (body.error as Record<string, unknown>).details = err.details;
    }

    res.status(err.statusCode).json(body);
    return;
  }

  // ── Unknown / programmer errors ────────────────────────────────────────────
  log.error({ err, requestId }, 'Unexpected error');
  metrics.httpErrors.increment({ code: '500' });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
    requestId,
  });
};
