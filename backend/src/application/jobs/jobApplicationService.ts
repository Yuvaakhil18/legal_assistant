import { getAnalysisQueue } from '../../queue/analysisQueue.js';
import { cacheGet } from '../../services/cache.js';

export interface JobStatusResponse {
  job_id: string;
  document_id: string;
  status: string;
  progress: number;
  error_message?: string;
}

export const jobApplicationService = {
  async getJobStatus(jobId: string): Promise<JobStatusResponse | null> {
    const queue = getAnalysisQueue();
    let job = null;
    
    if (queue) {
      try {
        job = await queue.getJob(jobId);
      } catch (e) {
        // Queue error or job not found
      }
    }

    // Attempt to read from Redis doc:status format if job object is missing or job is completed
    const match = jobId.match(/^job:doc:(.+)$/);
    const documentId = match ? match[1] : 'unknown';

    const redisStatusRaw = await cacheGet(`doc:status:${documentId}`);
    
    if (job) {
      const state = await job.getState();
      let progress = job.progress as number || 0;
      let error = job.failedReason;

      if (redisStatusRaw) {
        try {
          const parsed = JSON.parse(redisStatusRaw);
          if (parsed.progress_percentage !== undefined) progress = parsed.progress_percentage;
        } catch (e) {
          // ignore parse error
        }
      }

      return {
        job_id: jobId,
        document_id: documentId,
        status: state,
        progress,
        error_message: error
      };
    } else if (redisStatusRaw) {
      try {
        const parsed = JSON.parse(redisStatusRaw);
        return {
          job_id: jobId,
          document_id: documentId,
          status: parsed.status || 'unknown',
          progress: parsed.progress_percentage || 0,
          error_message: parsed.error_message
        };
      } catch (e) {
        // ignore parse error
      }
    }

    // If we can't find it anywhere, return null
    return null;
  }
};
