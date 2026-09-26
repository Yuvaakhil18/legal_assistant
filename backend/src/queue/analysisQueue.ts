import { Queue } from 'bullmq';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { checkRedisHealth } from '../services/cache.js';

import { AnalysisJob } from '../types/jobs.js';

export const ANALYSIS_QUEUE_NAME = 'contract-analysis-queue';
export const ANALYSIS_DLQ_NAME = 'contract-analysis-dlq';

let analysisQueue: Queue<AnalysisJob> | null = null;
// let dlqQueue: Queue<AnalysisJob> | null = null;
let isInMemoryQueueActive = false;

// Mock in-memory queue fallback for development and testing
interface MockJob {
  id: string;
  data: AnalysisJob;
  status: 'waiting' | 'active' | 'completed' | 'failed';
}
const mockQueueStore = new Map<string, MockJob>();

export function getAnalysisQueue(): Queue<AnalysisJob> | null {
  if (isInMemoryQueueActive) return null;

  if (!analysisQueue) {
    try {
      const redisOptions = {
        maxRetriesPerRequest: null,
        connectTimeout: 2000,
        lazyConnect: true
      };

      // BullMQ takes ioredis connection options directly
      analysisQueue = new Queue<AnalysisJob>(ANALYSIS_QUEUE_NAME, {
        connection: {
          url: env.REDIS_URL,
          ...redisOptions
        },
        defaultJobOptions: {
          attempts: env.ANALYSIS_JOB_MAX_RETRIES,
          backoff: {
            type: 'exponential',
            delay: 2000
          },
          removeOnComplete: {
            age: 3600, // Keep completed jobs for 1 hour
            count: 500
          },
          removeOnFail: false
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn('Failed to initialize BullMQ queue, using fallback', { failureReason: msg });
      if (env.USE_IN_MEMORY_FALLBACK) {
        isInMemoryQueueActive = true;
      }
    }
  }
  return analysisQueue;
}

export async function enqueueContractAnalysis(data: AnalysisJob): Promise<{ jobId: string; isFallback: boolean }> {
  const queue = getAnalysisQueue();

  if (!queue || isInMemoryQueueActive) {
    const jobId = `job:doc:${data.document_id}`;
    mockQueueStore.set(jobId, { id: jobId, data, status: 'waiting' });
    logger.info('Enqueued contract analysis job in in-memory queue', {
      jobId,
      documentId: data.document_id
    });
    return { jobId, isFallback: true };
  }

  try {
    const job = await queue.add('analyze', data, {
      jobId: `job:doc:${data.document_id}`
    });
    logger.info('Enqueued contract analysis job in BullMQ', {
      jobId: job.id,
      documentId: data.document_id
    });
    return { jobId: job.id ?? `job:doc:${data.document_id}`, isFallback: false };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (env.USE_IN_MEMORY_FALLBACK) {
      isInMemoryQueueActive = true;
      return enqueueContractAnalysis(data);
    }
    throw new Error(`Failed to enqueue analysis job: ${msg}`);
  }
}

export async function checkQueueHealth(): Promise<{ status: string; queueName: string; isFallback: boolean; error?: string }> {
  const redisHealth = await checkRedisHealth();
  if (redisHealth.isFallback || isInMemoryQueueActive) {
    return {
      status: 'operational',
      queueName: `${ANALYSIS_QUEUE_NAME} (in-memory-mock)`,
      isFallback: true
    };
  }

  const queue = getAnalysisQueue();
  if (!queue) {
    return {
      status: 'degraded',
      queueName: ANALYSIS_QUEUE_NAME,
      isFallback: false,
      error: 'Queue not initialized'
    };
  }

  try {
    await queue.getWaitingCount();
    return {
      status: 'healthy',
      queueName: ANALYSIS_QUEUE_NAME,
      isFallback: false
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (env.USE_IN_MEMORY_FALLBACK) {
      isInMemoryQueueActive = true;
      return {
        status: 'operational',
        queueName: `${ANALYSIS_QUEUE_NAME} (in-memory-mock)`,
        isFallback: true
      };
    }
    return {
      status: 'unhealthy',
      queueName: ANALYSIS_QUEUE_NAME,
      isFallback: false,
      error: msg
    };
  }
}
