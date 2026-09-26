import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { documentApplicationService } from '../application/documents/documentApplicationService.js';
import { AppError } from '../middleware/errorHandler.js';
import { FileSecurityError } from '../security/file/validator.js';

export const documentController = {
  async upload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new AppError(400, 'VALIDATION_FAILED', 'No file uploaded');
      }

      const { path, originalname, mimetype } = req.file;
      const result = await documentApplicationService.processUpload(path, originalname, mimetype);

      res.status(202).json(result);
    } catch (error) {
      if (error instanceof FileSecurityError) {
        const code = error.code === 'FILE_TOO_LARGE' ? 'FILE_TOO_LARGE' : 'VALIDATION_FAILED';
        next(new AppError(code === 'FILE_TOO_LARGE' ? 413 : 400, code as any, error.message));
        return;
      }
      next(error);
    }
  },

  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = z.string().uuid().safeParse(req.params.documentId);
      if (!parsed.success) {
        throw new AppError(400, 'VALIDATION_FAILED', 'Malformed document ID');
      }
      
      const doc = await documentApplicationService.getDocument(parsed.data);
      if (!doc) {
        throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
      }

      res.status(200).json(doc);
    } catch (error) {
      next(error);
    }
  }
};
