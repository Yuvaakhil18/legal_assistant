import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler.js';
import { jobApplicationService } from '../application/jobs/jobApplicationService.js';

export const jobController = {
  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      
      if (!jobId || typeof jobId !== 'string') {
        throw new AppError(400, 'VALIDATION_FAILED', 'Invalid job ID');
      }

      const status = await jobApplicationService.getJobStatus(jobId);
      
      if (!status) {
        throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Job not found');
      }

      res.status(200).json(status);
    } catch (error) {
      next(error);
    }
  }
};
