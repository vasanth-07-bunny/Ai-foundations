/**
 * Global test setup.
 *
 * - Sets test environment variables BEFORE config/index.ts is imported
 * - Mocks Prisma and Redis to prevent real I/O during unit tests
 * - Provides test factories for common domain objects
 */

import { vi } from 'vitest';

// ── Environment — set before any module import ────────────────────────────────
process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/agrin_test';
process.env['REDIS_URL'] = 'redis://localhost:6379/1';
process.env['JWT_ACCESS_SECRET'] = 'test-access-secret-min-32-chars-00000000';
process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret-min-32-chars-0000000';
process.env['JWT_ACCESS_EXPIRES_IN'] = '15m';
process.env['JWT_REFRESH_EXPIRES_IN_DAYS'] = '7';
process.env['PORT'] = '3001';
process.env['CORS_ORIGINS_RAW'] = 'http://localhost:5173';
process.env['OBJECT_STORAGE_BUCKET'] = 'agrin-test';
process.env['OBJECT_STORAGE_REGION'] = 'us-east-1';
process.env['LOG_LEVEL'] = 'silent';

// ── Mock Prisma ────────────────────────────────────────────────────────────────
vi.mock('../src/db/client.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    farmerProfile: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    farm: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    field: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    cropCycle: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    soilObservation: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    advisory: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    diseaseDiagnostic: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    uploadedImage: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    modelVersion: {
      findFirst: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    $transaction: vi.fn((fn) => fn({
      user: { create: vi.fn(), update: vi.fn() },
      farmerProfile: { create: vi.fn() },
    })),
  },
}));

// ── Mock Redis ─────────────────────────────────────────────────────────────────
vi.mock('../src/cache/client.js', () => ({
  redisClient: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    ping: vi.fn().mockResolvedValue('PONG'),
    disconnect: vi.fn(),
    multi: vi.fn(() => ({
      incr: vi.fn().mockReturnThis(),
      ttl: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([[null, 1], [null, -1]]),
    })),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    decr: vi.fn().mockResolvedValue(0),
    on: vi.fn(),
  },
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
  cacheDel: vi.fn().mockResolvedValue(undefined),
  CacheKeys: {
    advisory: (farmId: string, cropCycleId: string, date: string, lang: string) =>
      `advisory:${farmId}:${cropCycleId}:${date}:${lang}`,
    weather: (lat: number, lon: number) => `weather:${lat}:${lon}`,
    satellite: (lat: number, lon: number) => `satellite:${lat}:${lon}`,
    soil: (fieldId: string) => `soil:${fieldId}`,
  },
}));

// ── Mock Bull queue ────────────────────────────────────────────────────────────
vi.mock('../src/queue/index.js', () => ({
  initializeQueue: vi.fn().mockResolvedValue(undefined),
  enqueueDiagnostic: vi.fn().mockResolvedValue('test-job-id'),
  diagnosticQueue: { add: vi.fn(), process: vi.fn(), on: vi.fn() },
  advisoryQueue: { add: vi.fn(), process: vi.fn(), on: vi.fn() },
}));
