import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import * as jobApplicationService from '../../src/application/jobs/jobApplicationService.js';

describe('Job API Integration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/jobs/:jobId', () => {
    it('should return successful job status (13)', async () => {
      vi.spyOn(jobApplicationService.jobApplicationService, 'getJobStatus').mockResolvedValue({
        job_id: 'job:doc:123',
        document_id: '123',
        status: 'active',
        progress: 50
      });

      const res = await request(app).get('/api/jobs/job:doc:123');
      
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('active');
      expect(res.body.progress).toBe(50);
    });

    it('should return 404 for nonexistent job (14)', async () => {
      vi.spyOn(jobApplicationService.jobApplicationService, 'getJobStatus').mockResolvedValue(null);

      const res = await request(app).get('/api/jobs/missing-job');
      
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('DOCUMENT_NOT_FOUND');
    });
  });
});
