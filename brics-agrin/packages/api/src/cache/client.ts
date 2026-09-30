/**
 * Redis cache client singleton.
 *
 * Wraps ioredis with:
 *  - Connection event logging
 *  - Typed get/set helpers with TTL
 *  - JSON serialization
 *  - Graceful fallback (cache miss) when Redis is unavailable
 */

import Redis from 'ioredis';
import { config } from '../config/index.js';
import { createLogger } from '../observability/logger.js';

const log = createLogger('cache');

// ─── Client singleton ─────────────────────────────────────────────────────────

export const redisClient = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
  connectTimeout: 5000,
  // Reconnect with exponential back-off (max 30s)
  retryStrategy: (times: number) => {
    if (times > 10) return null; // stop retrying
    return Math.min(times * 200, 30_000);
  },
});

redisClient.on('connect', () => log.info('Redis connected'));
redisClient.on('ready', () => log.info('Redis ready'));
redisClient.on('error', (err) => log.error({ err }, 'Redis error'));
redisClient.on('close', () => log.warn('Redis connection closed'));
redisClient.on('reconnecting', () => log.info('Redis reconnecting'));

// ─── Typed helpers ────────────────────────────────────────────────────────────

/**
 * Get a cached value, returning null on miss or error.
 * Cache errors are logged and suppressed — never crash the request.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await redisClient.get(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    log.warn({ err, key }, 'Cache GET error — treating as miss');
    return null;
  }
}

/**
 * Set a cached value with TTL in seconds.
 * Errors are logged and suppressed.
 */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  try {
    await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    log.warn({ err, key }, 'Cache SET error — continuing without cache');
  }
}

/** Delete a cache key. Errors are suppressed. */
export async function cacheDel(key: string): Promise<void> {
  try {
    await redisClient.del(key);
  } catch (err) {
    log.warn({ err, key }, 'Cache DEL error');
  }
}

/**
 * Cache key builders — centralised so key format changes in one place.
 */
export const CacheKeys = {
  advisory: (farmId: string, cropCycleId: string, date: string, lang: string) =>
    `advisory:${farmId}:${cropCycleId}:${date}:${lang}`,

  weather: (lat: number, lon: number) =>
    `weather:${lat.toFixed(3)}:${lon.toFixed(3)}`,

  satellite: (lat: number, lon: number) =>
    `satellite:${lat.toFixed(3)}:${lon.toFixed(3)}`,

  soil: (fieldId: string) =>
    `soil:${fieldId}`,

  rateLimitLogin: (ip: string) =>
    `rl:login:${ip}`,
} as const;
