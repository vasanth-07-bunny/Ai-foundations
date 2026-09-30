/**
 * Rate limiting middleware using Redis as the store for consistency
 * across multiple API server instances.
 *
 * Three tiers:
 *  1. globalRateLimiter  — 100 req / 15 min per IP (all routes)
 *  2. authRateLimiter    — 10 req / 15 min per IP (auth routes only)
 *  3. advisoryRateLimiter — 30 req / 15 min per user (advisory generation)
 */

import rateLimit from 'express-rate-limit';
import { redisClient } from '../cache/client.js';
import { config } from '../config/index.js';

/**
 * Redis-backed store adapter for express-rate-limit.
 * Keeps counters consistent across horizontal API replicas.
 *
 * Uses a Lua script for atomic INCR+EXPIRE to eliminate the race condition
 * that exists when these are two separate commands.
 */
function createRedisStore(prefix: string) {
  // Lua script: atomically increment and set TTL on first increment
  // Returns {hits, ttlMs}
  const INCR_EXPIRE_SCRIPT = `
    local key = KEYS[1]
    local ttl = tonumber(ARGV[1])
    local hits = redis.call('INCR', key)
    if hits == 1 then
      redis.call('PEXPIRE', key, ttl)
    end
    local pttl = redis.call('PTTL', key)
    return {hits, pttl}
  `;

  return {
    async increment(key: string) {
      const fullKey = `${prefix}:${key}`;
      const windowMs = config.RATE_LIMIT_WINDOW_MS;

      const result = await redisClient.eval(
        INCR_EXPIRE_SCRIPT,
        1,
        fullKey,
        String(windowMs),
      ) as [number, number];

      const totalHits = result[0] ?? 1;
      const pttlMs = result[1] ?? windowMs;
      const resetTime = new Date(Date.now() + pttlMs);

      return { totalHits, resetTime };
    },
    async decrement(key: string) {
      await redisClient.decr(`${prefix}:${key}`);
    },
    async resetKey(key: string) {
      await redisClient.del(`${prefix}:${key}`);
    },
  };
}

export const globalRateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('rl:global'),
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
    },
  },
  skip: () => config.IS_TEST, // Disable in tests
});

export const authRateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('rl:auth'),
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please try again later.',
    },
  },
  skip: () => config.IS_TEST,
});

export const advisoryRateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('rl:advisory'),
  keyGenerator: (req) => req.id ?? req.ip ?? 'unknown',
  message: {
    success: false,
    error: {
      code: 'ADVISORY_RATE_LIMIT_EXCEEDED',
      message: 'Advisory request limit reached. Please try again later.',
    },
  },
  skip: () => config.IS_TEST,
});
