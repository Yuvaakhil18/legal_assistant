import { Worker, Job } from 'bullmq';
import { env } from '../config/env.js';
import { AnalysisJob, AnalysisJobSchema, JobResult } from '../types/jobs.js';
import { AnalysisJobOrchestrator } from '../services/analysis/analysisOrchestrator.js';
import { logger } from '../utils/logger.js';
import { checkRedisHealth, getRedisClient } from '../services/cache.js';
import { documentRepository } from '../repositories/documentRepository.js';

export class AnalysisWorker {
  private worker: Worker<AnalysisJob, JobResult> | null = null;
  private orchestrator: AnalysisJobOrchestrator;

  constructor() {
    this.orchestrator = new AnalysisJobOrchestrator();
  }

  async start(): Promise<void> {
    const health = await checkRedisHealth();
    if (health.isFallback) {
      logger.warn('Analysis Worker not starting: Redis is in in-memory fallback mode.');
      return;
    }

    const redis = getRedisClient();
    if (!redis) {
      throw new Error('Analysis Worker cannot start: Redis client is null.');
    }

    logger.info('Starting Analysis Worker for contract-analysis-queue...');
    
    this.worker = new Worker<AnalysisJob, JobResult>(
      'contract-analysis-queue',
      async (job: Job<AnalysisJob>) => {
        const start = Date.now();
        const requestData = job.data;
        
        logger.info(`Processing AnalysisJob ${job.id}`, { documentId: requestData.document_id });
        
        try {
          // Validate incoming schema
          const validated = AnalysisJobSchema.parse(requestData);
          
          await this.orchestrator.execute(validated);
          
          const duration_ms = Date.now() - start;
          
          logger.info(`Successfully completed AnalysisJob ${job.id}`, { documentId: validated.document_id, duration_ms });
          
          return {
            job_id: job.id || validated.job_id,
            status: 'completed',
            duration_ms,
            processed_at: new Date().toISOString()
          };
          
        } catch (error) {
          const duration_ms = Date.now() - start;
          const msg = error instanceof Error ? error.message : String(error);
          
          logger.error(`Failed AnalysisJob ${job.id}`, { 
            documentId: requestData.document_id,
            failureReason: msg,
            duration_ms
          });

          // Ensure document transitions to failed on fatal error
          if (requestData.document_id) {
            try {
              await documentRepository.updateDocumentStatus(requestData.document_id, 'failed', msg);
            } catch (dbErr) {
              logger.error('Failed to update document status to failed', { dbErr });
            }
          }
          
          // Do not expose stack traces in the returned job error object
          throw new Error(msg);
        }
      },
      {
        connection: redis,
        concurrency: (env as any).WORKER_CONCURRENCY || 2,
        limiter: {
          max: 100,
          duration: 1000
        }
      }
    );

    this.worker.on('failed', (job, err) => {
      logger.error(`Job ${job?.id} failed in BullMQ: ${err.message}`);
    });

    this.worker.on('error', err => {
      logger.error(`Worker error: ${err.message}`);
    });
  }

  async stop(): Promise<void> {
    if (this.worker) {
      logger.info('Closing Analysis Worker...');
      await this.worker.close();
      this.worker = null;
    }
  }
}
