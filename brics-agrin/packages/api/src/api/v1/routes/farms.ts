/**
 * @swagger
 * tags:
 *   name: Farms
 *   description: Farm management
 */

import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import {
  CreateFarmSchema,
  UpdateFarmSchema,
  PaginationQuerySchema,
} from '@brics-agrin/shared';
import { farmService } from '../../../services/farm/FarmService.js';
import { auditService } from '../../../services/auth/AuditService.js';
import { sendSuccess, sendCreated, sendNoContent } from '../../../utils/response.js';
import type { Request, Response, NextFunction } from 'express';

export const farmRouter = Router();

// GET /api/v1/farms
farmRouter.get(
  '/',
  authenticate,
  validate('query', PaginationQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await farmService.listFarms(req.user!.userId, req.query as never);
      sendSuccess(req, res, result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/farms
farmRouter.post(
  '/',
  authenticate,
  validate('body', CreateFarmSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const farm = await farmService.createFarm(req.body, req.user!.userId);
      await auditService.record({
        userId: req.user!.userId,
        action: 'FARM_CREATE',
        resourceType: 'farm',
        resourceId: farm.id,
        ipAddress: req.ip ?? undefined,
      });
      sendCreated(req, res, farm);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/farms/:farmId
farmRouter.get(
  '/:farmId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const farm = await farmService.getFarm(req.params.farmId!, req.user!.userId);
      sendSuccess(req, res, farm);
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/farms/:farmId
farmRouter.patch(
  '/:farmId',
  authenticate,
  validate('body', UpdateFarmSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const farm = await farmService.updateFarm(req.params.farmId!, req.user!.userId, req.body);
      await auditService.record({
        userId: req.user!.userId,
        action: 'FARM_UPDATE',
        resourceType: 'farm',
        resourceId: farm.id,
        ipAddress: req.ip ?? undefined,
      });
      sendSuccess(req, res, farm);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/v1/farms/:farmId
farmRouter.delete(
  '/:farmId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await farmService.deleteFarm(req.params.farmId!, req.user!.userId);
      await auditService.record({
        userId: req.user!.userId,
        action: 'FARM_DELETE',
        resourceType: 'farm',
        resourceId: req.params.farmId,
        ipAddress: req.ip ?? undefined,
      });
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  },
);
