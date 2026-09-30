/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication and token management
 */

import { Router } from 'express';
import { authRateLimiter } from '../../../middleware/rateLimiter.js';
import { validate } from '../../../middleware/validate.js';
import { authenticate } from '../../../middleware/authenticate.js';
import { RegisterSchema, LoginSchema, RefreshTokenSchema } from '@brics-agrin/shared';
import { authService } from '../../../services/auth/AuthService.js';
import { sendSuccess, sendCreated } from '../../../utils/response.js';
import type { Request, Response, NextFunction } from 'express';

export const authRouter = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new farmer account
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201: { description: Account created }
 *       400: { description: Validation error }
 *       409: { description: Email already registered }
 */
authRouter.post(
  '/register',
  authRateLimiter,
  validate('body', RegisterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.register(
        req.body,
        req.ip ?? undefined,
        req.headers['user-agent'],
      );
      sendCreated(req, res, result);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Authenticate and receive tokens
 *     security: []
 */
authRouter.post(
  '/login',
  authRateLimiter,
  validate('body', LoginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.login(
        req.body.email,
        req.body.password,
        req.ip ?? undefined,
        req.headers['user-agent'],
      );
      sendSuccess(req, res, result);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Rotate refresh token and issue new access token
 *     security: []
 */
authRouter.post(
  '/refresh',
  authRateLimiter,
  validate('body', RefreshTokenSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tokens = await authService.refresh(
        req.body.refreshToken,
        req.ip ?? undefined,
        req.headers['user-agent'],
      );
      sendSuccess(req, res, tokens);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Revoke refresh token and invalidate session
 */
authRouter.post(
  '/logout',
  authenticate,
  validate('body', RefreshTokenSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.logout(req.body.refreshToken, req.user!.userId);
      sendSuccess(req, res, { message: 'Logged out successfully' });
    } catch (err) {
      next(err);
    }
  },
);
