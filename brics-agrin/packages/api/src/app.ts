/**
 * Express application factory.
 * Separated from index.ts so the app can be tested without binding to a port.
 */

import express, { type Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';

import { config } from './config/index.js';
import { logger } from './observability/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestId } from './middleware/requestId.js';
import { globalRateLimiter } from './middleware/rateLimiter.js';
import { v1Router } from './api/v1/index.js';
import { healthRouter } from './api/health.js';
import { setupSwagger } from './api/swagger.js';

export function createApp(): Application {
  const app = express();

  // ── Security headers ──────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameSrc: ["'none'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    }),
  );

  // ── CORS ──────────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: config.CORS_ORIGINS,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  // ── Request tracing ───────────────────────────────────────────────────────
  app.use(requestId);

  // ── Structured HTTP logging ───────────────────────────────────────────────
  app.use(
    pinoHttp({
      logger,
      // Never log Authorization header values
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie'],
        censor: '[REDACTED]',
      },
      customLogLevel: (_req, res) => {
        if (res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );

  // ── Body parsing ──────────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());

  // ── Compression ───────────────────────────────────────────────────────────
  app.use(compression());

  // ── Global rate limiting ──────────────────────────────────────────────────
  app.use(globalRateLimiter);

  // ── API docs (non-production only) ────────────────────────────────────────
  if (config.NODE_ENV !== 'production') {
    setupSwagger(app);
  }

  // ── Routes ────────────────────────────────────────────────────────────────
  app.use('/health', healthRouter);
  app.use('/api/v1', v1Router);

  // ── 404 handler ───────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found',
      },
    });
  });

  // ── Global error handler ──────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
