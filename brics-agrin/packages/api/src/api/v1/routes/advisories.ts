/**
 * Advisory routes.
 *
 * POST /advisories/generate  — trigger advisory for a farm's active crop
 * GET  /advisories            — list advisories for a farm
 * GET  /advisories/:id        — get a specific advisory
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { advisoryRateLimiter } from '../../../middleware/rateLimiter.js';
import { AdvisoryRequestSchema, PaginationQuerySchema } from '@brics-agrin/shared';
import { advisoryService } from '../../../services/advisory/AdvisoryService.js';
import { farmService } from '../../../services/farm/FarmService.js';
import { prisma } from '../../../db/client.js';
import { sendSuccess } from '../../../utils/response.js';
import { NotFoundError, ValidationError } from '../../../utils/errors.js';
import { auditService } from '../../../services/auth/AuditService.js';
import type { Request, Response, NextFunction } from 'express';
import type { SupportedLanguage } from '@brics-agrin/shared';

export const advisoryRouter = Router();

// POST /api/v1/advisories/generate
advisoryRouter.post(
  '/generate',
  authenticate,
  advisoryRateLimiter,
  validate('body', AdvisoryRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { farmId, fieldId, cropCycleId, language } = req.body as {
        farmId: string;
        fieldId?: string;
        cropCycleId?: string;
        language: SupportedLanguage;
      };

      // Fetch farm context for the engine
      const farm = await farmService.getFarm(farmId, req.user!.userId);

      // Find active crop cycle if not specified
      let resolvedCropCycleId = cropCycleId;
      let cropName = 'unknown';
      let growthStage = 'vegetative';
      let resolvedFieldId = fieldId;

      if (cropCycleId) {
        const cycle = await prisma.cropCycle.findUnique({
          where: { id: cropCycleId },
          include: { field: true },
        });
        if (!cycle) throw new NotFoundError('CropCycle', cropCycleId);
        cropName = cycle.cropName;
        growthStage = cycle.growthStage.toLowerCase();
        resolvedFieldId = cycle.fieldId;
      } else if (fieldId) {
        const cycle = await prisma.cropCycle.findFirst({
          where: { fieldId, isActive: true },
        });
        if (cycle) {
          resolvedCropCycleId = cycle.id;
          cropName = cycle.cropName;
          growthStage = cycle.growthStage.toLowerCase();
        }
      } else {
        // Use first active crop cycle across all fields
        const cycle = await prisma.cropCycle.findFirst({
          where: { field: { farmId }, isActive: true },
          include: { field: true },
        });
        if (cycle) {
          resolvedCropCycleId = cycle.id;
          cropName = cycle.cropName;
          growthStage = cycle.growthStage.toLowerCase();
          resolvedFieldId = cycle.fieldId;
        }
      }

      const advisory = await advisoryService.generateForFarm(
        {
          farmId,
          cropCycleId: resolvedCropCycleId,
          location: farm.location,
          country: farm.country,
          cropName,
          growthStage,
          farmingPractice: farm.farmingPractice.toUpperCase(),
          irrigationType: farm.irrigationType.toUpperCase(),
          areaHectares: farm.areaHectares,
          fieldId: resolvedFieldId,
          language,
        },
        req.user!.userId,
      );

      await auditService.record({
        userId: req.user!.userId,
        action: 'ADVISORY_GENERATE',
        resourceType: 'farm',
        resourceId: farmId,
      });

      sendSuccess(req, res, advisory);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/advisories?farmId=&page=&pageSize=
advisoryRouter.get(
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
      const result = await advisoryService.listForFarm(
        farmId,
        req.user!.userId,
        { page, pageSize },
      );
      sendSuccess(req, res, result);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/advisories/:id
advisoryRouter.get(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const advisory = await advisoryService.getById(req.params.id!, req.user!.userId);
      sendSuccess(req, res, advisory);
    } catch (err) {
      next(err);
    }
  },
);
