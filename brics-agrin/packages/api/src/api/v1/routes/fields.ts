import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { CreateFieldSchema } from '@brics-agrin/shared';
import { farmService } from '../../../services/farm/FarmService.js';
import { sendSuccess, sendCreated } from '../../../utils/response.js';
import type { Request, Response, NextFunction } from 'express';

// Note: Router uses mergeParams so :farmId from parent router is accessible
export const fieldRouter = Router({ mergeParams: true });

// GET /api/v1/farms/:farmId/fields
fieldRouter.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const fields = await farmService.listFields(req.params.farmId!, req.user!.userId);
      sendSuccess(req, res, fields);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/farms/:farmId/fields
fieldRouter.post(
  '/',
  authenticate,
  validate('body', CreateFieldSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const field = await farmService.createField(
        req.params.farmId!,
        req.user!.userId,
        req.body,
      );
      sendCreated(req, res, field);
    } catch (err) {
      next(err);
    }
  },
);
