/**
 * JWT authentication middleware.
 *
 * Verifies the access token, loads minimal user context into req.user.
 * Authorization (resource ownership checks) happens in individual
 * service layers — NOT here.
 *
 * Security:
 *  - Tokens must be in Authorization header (Bearer scheme)
 *  - Never accept tokens in query strings or custom headers
 *  - Expired tokens are rejected with 401, not silently refreshed
 */

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { AuthenticationError, AuthorizationError } from '../utils/errors.js';
import type { AuthContext } from '../domain/user/types.js';
import type { UserRole } from '@prisma/client';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthContext;
    }
  }
}

interface AccessTokenPayload {
  sub: string;         // userId
  role: UserRole;
  profileId: string | null;
  iat: number;
  exp: number;
}

/**
 * Require a valid JWT access token.
 * Attaches decoded user context to req.user.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AuthenticationError('Missing or malformed Authorization header'));
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, config.JWT_ACCESS_SECRET) as AccessTokenPayload;

    req.user = {
      userId: payload.sub,
      role: payload.role,
      farmerProfileId: payload.profileId,
    };

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(new AuthenticationError('Access token has expired'));
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return next(new AuthenticationError('Invalid access token'));
    }
    next(err);
  }
}

/**
 * Optional authentication — populates req.user if a valid token is present,
 * but does not reject unauthenticated requests.
 */
export function optionalAuthenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader) return next();
  authenticate(req, res, next);
}

/**
 * Role-based access control guard.
 * Must be used AFTER authenticate().
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthenticationError());
    }
    if (!roles.includes(req.user.role)) {
      return next(new AuthorizationError('Insufficient permissions'));
    }
    next();
  };
}
