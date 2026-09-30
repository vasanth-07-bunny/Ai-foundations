/**
 * Zod validation middleware factory.
 *
 * Validates req.body, req.query, or req.params against a Zod schema.
 * On failure, throws a ValidationError that the global error handler maps
 * to a 400 response with field-level details.
 *
 * Usage:
 *   router.post('/farms', authenticate, validate('body', CreateFarmSchema), createFarm);
 */

import type { Request, Response, NextFunction } from 'express';
import type { ZodType, ZodTypeDef, z } from 'zod';
import { ValidationError } from '../utils/errors.js';

type RequestPart = 'body' | 'query' | 'params';

export function validate<TOutput, TDef extends ZodTypeDef, TInput>(
  part: RequestPart,
  schema: ZodType<TOutput, TDef, TInput>,
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      const details: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const path = issue.path.join('.') || 'root';
        details[path] = issue.message;
      });
      return next(new ValidationError('Request validation failed', details));
    }

    // Replace the raw input with the parsed/coerced/default-filled output
    // so downstream handlers work with validated data
    req[part] = result.data as typeof req[typeof part];
    next();
  };
}
