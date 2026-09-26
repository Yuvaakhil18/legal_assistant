import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { checkDbHealth } from './db/connection.js';
import { checkRedisHealth } from './services/cache.js';

async function bootstrap() {
  logger.info('Initializing Legal Intelligence Platform (Architecture V2)...');

  // Verify infrastructure connections
  const dbHealth = await checkDbHealth();
  logger.info(`Database connectivity: ${dbHealth.provider} (Fallback: ${dbHealth.isFallback})`);

  const redisHealth = await checkRedisHealth();
  logger.info(`Redis cache connectivity: ${redisHealth.provider} (Fallback: ${redisHealth.isFallback})`);

  // Start background worker
  let worker: any = null;
  if (!redisHealth.isFallback) {
    const { AnalysisWorker } = await import('./workers/analysisWorker.js');
    worker = new AnalysisWorker();
    await worker.start();
  }

  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 API Server running on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
    logger.info(`📋 Health check available at http://localhost:${env.PORT}/api/health`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    if (worker) {
      await worker.stop();
    }
    server.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error('Fatal error during application startup', {
    failureReason: err instanceof Error ? err.message : String(err)
  });
  process.exit(1);
});
