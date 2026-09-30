/**
 * Consistent API response helpers.
 *
 * All controllers use these functions so the response shape is
 * guaranteed to be consistent — never hand-rolled per-controller.
 */

import type { Response } from 'express';
import type { Request } from 'express';

export function sendSuccess<T>(
  req: Request,
  res: Response,
  data: T,
  statusCode = 200,
): void {
  res.status(statusCode).json({
    success: true,
    data,
    requestId: req.id,
  });
}

export function sendCreated<T>(req: Request, res: Response, data: T): void {
  sendSuccess(req, res, data, 201);
}

export function sendNoContent(res: Response): void {
  res.status(204).send();
}
