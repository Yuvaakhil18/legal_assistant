import { Router, Request, Response } from 'express';
import { checkDbHealth } from '../db/connection.js';
import { checkRedisHealth } from '../services/cache.js';
import { checkQueueHealth } from '../queue/analysisQueue.js';
import { env } from '../config/env.js';
import { createSuccessEnvelope } from '../middleware/disclaimer.js';

export const healthRouter = Router();

healthRouter.get('/health', async (req: Request, res: Response) => {
  const dbStatus = await checkDbHealth();
  const redisStatus = await checkRedisHealth();
  const queueStatus = await checkQueueHealth();

  const isHealthy = (dbStatus.connected || dbStatus.isFallback) &&
                    (redisStatus.connected || redisStatus.isFallback);

  const healthData = {
    status: isHealthy ? 'healthy' : 'degraded',
    version: '1.0.0',
    architecture: 'v2',
    uptime_seconds: Math.floor(process.uptime()),
    database: {
      connected: dbStatus.connected,
      provider: dbStatus.provider,
      is_fallback: dbStatus.isFallback,
      ...(dbStatus.error ? { error: dbStatus.error } : {})
    },
    cache: {
      connected: redisStatus.connected,
      provider: redisStatus.provider,
      is_fallback: redisStatus.isFallback,
      ...(redisStatus.error ? { error: redisStatus.error } : {})
    },
    queue: {
      status: queueStatus.status,
      queue_name: queueStatus.queueName,
      is_fallback: queueStatus.isFallback,
      ...(queueStatus.error ? { error: queueStatus.error } : {})
    },
    ai_engine: {
      provider: 'google-gemini',
      model_reasoning: env.MODEL_REASONING,
      model_embedding: env.MODEL_EMBEDDING,
      embedding_dimensions: env.EMBEDDING_DIMENSIONS,
      status: 'configured'
    }
  };

  res.status(isHealthy ? 200 : 503).json(createSuccessEnvelope(req, healthData));
});
