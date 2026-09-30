/**
 * BRICS AgriN API Server — Entry Point
 *
 * Starts the Express application, establishes DB and cache connections,
 * initializes the job queue, and begins listening for requests.
 */

import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './observability/logger.js';
import { prisma } from './db/client.js';
import { redisClient } from './cache/client.js';
import { initializeQueue } from './queue/index.js';
import { registerAllowedProviderUrls } from './utils/httpClient.js';

async function bootstrap(): Promise<void> {
  // Validate configuration first — fail fast if env is misconfigured
  logger.info({ env: config.NODE_ENV }, 'Starting BRICS AgriN API');

  // Register allowed provider URLs for SSRF protection
  registerAllowedProviderUrls();

  // Verify database connectivity
  try {
    await prisma.$connect();
    logger.info('Database connection established');
  } catch (error) {
    logger.error({ error }, 'Failed to connect to database');
    process.exit(1);
  }

  // Verify cache connectivity
  try {
    await redisClient.ping();
    logger.info('Cache connection established');
  } catch (error) {
    logger.error({ error }, 'Failed to connect to Redis cache');
    process.exit(1);
  }

  // Initialize background job queue
  await initializeQueue();
  logger.info('Job queue initialized');

  // Create and start HTTP server
  const app = createApp();
  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT, env: config.NODE_ENV }, 'HTTP server listening');
  });

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutdown signal received');
    server.close(async () => {
      await prisma.$disconnect();
      redisClient.disconnect();
      logger.info('Server shutdown complete');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection');
    process.exit(1);
  });

  process.on('uncaughtException', (error) => {
    logger.error({ error }, 'Uncaught exception');
    process.exit(1);
  });
}

bootstrap();
