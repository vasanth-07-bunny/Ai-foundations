/**
 * Attaches a unique request ID to every request and response.
 * All log lines for that request automatically include this ID,
 * enabling full request tracing without a distributed tracing system.
 */

import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

export function requestId(req: Request, res: Response, next: NextFunction): void {
  // Respect forwarded request ID from upstream proxies (e.g. API gateway)
  const incomingId = req.headers['x-request-id'];
  const id = typeof incomingId === 'string' && incomingId.length < 64
    ? incomingId
    : randomUUID();

  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
}
