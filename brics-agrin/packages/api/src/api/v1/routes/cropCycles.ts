import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { CreateCropCycleSchema, UpdateCropStageSchema } from '@brics-agrin/shared';
import { farmService } from '../../../services/farm/FarmService.js';
import { sendSuccess, sendCreated } from '../../../utils/response.js';
import type { Request, Response, NextFunction } from 'express';

export const cropCycleRouter = Router({ mergeParams: true });

// GET /api/v1/fields/:fieldId/crop-cycles/active
cropCycleRouter.get(
  '/active',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cycle = await farmService.getActiveCropCycle(
        req.params.fieldId!,
        req.user!.userId,
      );
      sendSuccess(req, res, cycle);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/fields/:fieldId/crop-cycles
cropCycleRouter.post(
  '/',
  authenticate,
  validate('body', CreateCropCycleSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cycle = await farmService.createCropCycle(
        req.params.fieldId!,
        req.user!.userId,
        {
          ...req.body,
          sowingDate: new Date(req.body.sowingDate),
          expectedHarvestDate: req.body.expectedHarvestDate
            ? new Date(req.body.expectedHarvestDate)
            : undefined,
        },
      );
      sendCreated(req, res, cycle);
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/fields/:fieldId/crop-cycles/:cycleId/stage
cropCycleRouter.patch(
  '/:cycleId/stage',
  authenticate,
  validate('body', UpdateCropStageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cycle = await farmService.updateCropStage(
        req.params.cycleId!,
        req.user!.userId,
        req.body.growthStage,
      );
      sendSuccess(req, res, cycle);
    } catch (err) {
      next(err);
    }
  },
);
