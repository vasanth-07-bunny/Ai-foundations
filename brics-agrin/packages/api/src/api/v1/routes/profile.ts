import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { UpdateProfileSchema } from '@brics-agrin/shared';
import { prisma } from '../../../db/client.js';
import { sendSuccess } from '../../../utils/response.js';
import { NotFoundError } from '../../../utils/errors.js';
import type { Request, Response, NextFunction } from 'express';

export const profileRouter = Router();

profileRouter.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await prisma.farmerProfile.findUnique({
        where: { userId: req.user!.userId },
      });
      if (!profile) throw new NotFoundError('FarmerProfile');
      sendSuccess(req, res, {
        id: profile.id,
        userId: profile.userId,
        country: profile.country,
        language: profile.language,
        farmCategory: profile.farmCategory.toLowerCase(),
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

profileRouter.patch(
  '/',
  authenticate,
  validate('body', UpdateProfileSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await prisma.farmerProfile.findUnique({
        where: { userId: req.user!.userId },
      });
      if (!profile) throw new NotFoundError('FarmerProfile');

      const updated = await prisma.farmerProfile.update({
        where: { userId: req.user!.userId },
        data: {
          ...(req.body.language ? { language: req.body.language } : {}),
          ...(req.body.farmCategory
            ? { farmCategory: req.body.farmCategory.toUpperCase() as never }
            : {}),
        },
      });

      sendSuccess(req, res, {
        id: updated.id,
        language: updated.language,
        farmCategory: updated.farmCategory.toLowerCase(),
        updatedAt: updated.updatedAt.toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);
