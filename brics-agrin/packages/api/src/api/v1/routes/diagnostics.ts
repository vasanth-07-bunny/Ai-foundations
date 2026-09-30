/**
 * Diagnostic routes.
 *
 * POST /diagnostics/images     — upload a crop disease image (returns imageId)
 * POST /diagnostics             — submit diagnostic request (async, returns pending)
 * GET  /diagnostics/:id         — poll for diagnostic result
 * GET  /diagnostics?farmId=     — list diagnostics for a farm
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { handleImageUpload } from '../../../middleware/imageUpload.js';
import { advisoryRateLimiter } from '../../../middleware/rateLimiter.js';
import { DiagnosticRequestSchema, PaginationQuerySchema } from '@brics-agrin/shared';
import { imageUploadService } from '../../../services/diagnostic/ImageUploadService.js';
import { diagnosticService } from '../../../services/diagnostic/DiagnosticService.js';
import { auditService } from '../../../services/auth/AuditService.js';
import { sendSuccess, sendCreated } from '../../../utils/response.js';
import { ValidationError } from '../../../utils/errors.js';
import type { Request, Response, NextFunction } from 'express';

export const diagnosticRouter = Router();

/**
 * POST /api/v1/diagnostics/images
 * Upload a crop image for disease diagnosis.
 * Returns { imageId } to be used in the diagnostic request.
 */
diagnosticRouter.post(
  '/images',
  authenticate,
  advisoryRateLimiter,
  handleImageUpload,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new ValidationError('No image file provided. Use multipart/form-data with field name "image".');
      }

      const uploaded = await imageUploadService.upload(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname,
        req.user!.userId,
      );

      await auditService.record({
        userId: req.user!.userId,
        action: 'IMAGE_UPLOAD',
        resourceType: 'uploadedImage',
        resourceId: uploaded.id,
        ipAddress: req.ip ?? undefined,
        metadata: { mimeType: uploaded.mimeType, sizeBytes: uploaded.sizeBytes },
      });

      sendCreated(req, res, {
        imageId: uploaded.id,
        mimeType: uploaded.mimeType,
        widthPx: uploaded.widthPx,
        heightPx: uploaded.heightPx,
        sizeBytes: uploaded.sizeBytes,
        message: 'Image uploaded successfully. Use the imageId in your diagnostic request.',
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/diagnostics
 * Submit a diagnostic request using a previously uploaded image.
 * Processing is asynchronous — poll GET /diagnostics/:id for results.
 */
diagnosticRouter.post(
  '/',
  authenticate,
  advisoryRateLimiter,
  validate('body', DiagnosticRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await diagnosticService.submit({
        ...req.body,
        userId: req.user!.userId,
      });

      await auditService.record({
        userId: req.user!.userId,
        action: 'DIAGNOSTIC_SUBMIT',
        resourceType: 'diagnostic',
        resourceId: result.id,
        ipAddress: req.ip ?? undefined,
      });

      sendCreated(req, res, result);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/diagnostics/:id
 * Poll for diagnostic result. Status will be PENDING → PROCESSING → COMPLETED/FAILED.
 */
diagnosticRouter.get(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await diagnosticService.getById(req.params.id!, req.user!.userId);
      sendSuccess(req, res, result);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/diagnostics?farmId=&page=&pageSize=
 */
diagnosticRouter.get(
  '/',
  authenticate,
  validate('query', PaginationQuerySchema.merge(z.object({ farmId: z.string().uuid() }))),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { farmId, page, pageSize } = req.query as {
        farmId: string;
        page: number;
        pageSize: number;
      };
      const result = await diagnosticService.listForFarm(farmId, req.user!.userId, {
        page,
        pageSize,
      });
      sendSuccess(req, res, result);
    } catch (err) {
      next(err);
    }
  },
);
