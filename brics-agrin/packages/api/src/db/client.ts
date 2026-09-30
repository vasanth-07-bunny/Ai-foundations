/**
 * Prisma client singleton.
 *
 * Using a single shared instance prevents connection pool exhaustion.
 * In development, attaches the instance to the global object to survive
 * hot-module reloads without creating multiple pools.
 *
 * NODE_ENV is read directly here — this module is intentionally
 * bootstrapped before the full config module to avoid circular imports.
 * It is the only permitted process.env access outside config/index.ts.
 */

import { PrismaClient } from '@prisma/client';

type GlobalWithPrisma = typeof globalThis & {
  __prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const env = process.env['NODE_ENV'];
  return new PrismaClient({
    log:
      env === 'development'
        ? ['query', 'warn', 'error']
        : ['warn', 'error'],
    errorFormat: 'minimal',
  });
}

const globalForPrisma = globalThis as GlobalWithPrisma;

export const prisma: PrismaClient =
  globalForPrisma.__prisma ?? createPrismaClient();

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.__prisma = prisma;
}
