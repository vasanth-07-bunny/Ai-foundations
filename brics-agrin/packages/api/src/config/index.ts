/**
 * Centralised application configuration.
 *
 * All environment variables are read and validated here at startup.
 * If a required variable is missing the application fails fast with
 * a descriptive error — never silently falling back to an insecure default.
 *
 * NEVER import process.env anywhere else in the application.
 */

import { z } from 'zod';

// ─── Schema ───────────────────────────────────────────────────────────────────

const configSchema = z.object({
  // Runtime
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),

  // Database
  DATABASE_URL: z.string().url().startsWith('postgresql'),

  // Redis
  REDIS_URL: z.string().url().startsWith('redis'),

  // JWT — must be long random secrets, never hardcoded
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN_DAYS: z.coerce.number().int().min(1).max(30).default(7),

  // CORS — comma-separated list of allowed origins
  CORS_ORIGINS_RAW: z.string().default('http://localhost:5173'),

  // Object Storage (S3-compatible)
  OBJECT_STORAGE_ENDPOINT: z.string().url().optional(),
  OBJECT_STORAGE_BUCKET: z.string().min(1).default('agrin-uploads'),
  OBJECT_STORAGE_REGION: z.string().default('us-east-1'),
  OBJECT_STORAGE_ACCESS_KEY: z.string().optional(),
  OBJECT_STORAGE_SECRET_KEY: z.string().optional(),

  // AI / Advisory Engine
  OPENAI_API_KEY: z.string().optional(),
  ADVISORY_MODEL_VERSION: z.string().default('1.0.0'),
  DIAGNOSTIC_MODEL_VERSION: z.string().default('1.0.0'),

  // External Data Providers
  OPENMETEO_BASE_URL: z.string().url().default('https://api.open-meteo.com'),
  // Satellite — optional; falls back to stub when not provided
  SATELLITE_API_KEY: z.string().optional(),
  SATELLITE_BASE_URL: z.string().url().optional(),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().default(15 * 60 * 1000),  // 15 min
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().default(100),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().default(10),

  // Image upload constraints
  IMAGE_MAX_SIZE_BYTES: z.coerce.number().int().default(10 * 1024 * 1024),  // 10 MB
  IMAGE_MAX_DIMENSION_PX: z.coerce.number().int().default(4096),
  // Comma-separated allowed MIME types
  IMAGE_ALLOWED_MIME_TYPES_RAW: z
    .string()
    .default('image/jpeg,image/png,image/webp'),

  // Advisory cache TTL
  ADVISORY_CACHE_TTL_SECONDS: z.coerce.number().int().default(3600),   // 1 hour
  WEATHER_CACHE_TTL_SECONDS: z.coerce.number().int().default(1800),    // 30 min
  SATELLITE_CACHE_TTL_SECONDS: z.coerce.number().int().default(7200),  // 2 hours

  // Timeouts for external HTTP calls (ms)
  EXTERNAL_HTTP_TIMEOUT_MS: z.coerce.number().int().default(8000),
  EXTERNAL_HTTP_RETRIES: z.coerce.number().int().min(0).max(5).default(3),
});

// ─── Parse & export ───────────────────────────────────────────────────────────

function parseConfig() {
  const result = configSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    // Crash immediately — misconfigured service must not start
    throw new Error(`Configuration validation failed:\n${issues}`);
  }

  const raw = result.data;

  return {
    ...raw,
    // Derived values — computed once, not re-computed on every access
    CORS_ORIGINS: raw.CORS_ORIGINS_RAW.split(',').map((o) => o.trim()),
    IMAGE_ALLOWED_MIME_TYPES: raw.IMAGE_ALLOWED_MIME_TYPES_RAW.split(',').map((m) => m.trim()),
    IS_PRODUCTION: raw.NODE_ENV === 'production',
    IS_TEST: raw.NODE_ENV === 'test',
  } as const;
}

export type AppConfig = ReturnType<typeof parseConfig>;
export const config: AppConfig = parseConfig();
