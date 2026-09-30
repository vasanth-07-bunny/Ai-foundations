/**
 * Structured logger — Pino.
 *
 * Rules:
 *  - Always structured JSON in production
 *  - Pretty-print in development
 *  - NEVER log passwords, tokens, API keys, or private farmer data
 *  - Sensitive fields are redacted at the logger level as a safety net
 *
 * NOTE: This module is intentionally bootstrapped before config/index.ts
 * to make logging available during config validation itself. It is one of
 * two permitted direct process.env accesses (the other is db/client.ts).
 * All other modules must import from config/index.ts.
 *
 * Usage:
 *   import { logger } from './observability/logger.js';
 *   logger.info({ farmId }, 'Advisory generated');
 *   logger.error({ err }, 'Database connection failed');
 */

import pino from 'pino';

const REDACTED_PATHS = [
  'password',
  'passwordHash',
  'password_hash',
  'token',
  'accessToken',
  'refreshToken',
  'access_token',
  'refresh_token',
  'authorization',
  'apiKey',
  'api_key',
  'secret',
  'fileHash',          // Image content hashes
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'OPENAI_API_KEY',
  'SATELLITE_API_KEY',
  'OBJECT_STORAGE_SECRET_KEY',
  'OBJECT_STORAGE_ACCESS_KEY',
];

// Read directly from process.env — permitted exception to centralized config
// (logger is needed before config module is loaded)
const env = process.env['NODE_ENV'] ?? 'development';
const isTest = env === 'test';
const isDev = env === 'development';

export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? (isTest ? 'silent' : 'info'),
  redact: {
    paths: REDACTED_PATHS,
    censor: '[REDACTED]',
  },
  // Base context included in every log line
  base: {
    service: 'brics-agrin-api',
    env,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // In development, use pino-pretty transport if available
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname,service,env',
          },
        },
      }
    : {}),
});

/**
 * Child logger factory — adds module-level context to every log line.
 * Use this in individual modules instead of importing the root logger.
 *
 * @example
 *   const log = createLogger('advisory-engine');
 *   log.info({ farmId }, 'Generating advisory');
 */
export function createLogger(module: string): pino.Logger {
  return logger.child({ module });
}
