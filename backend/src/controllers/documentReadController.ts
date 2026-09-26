import { Request, Response, NextFunction } from 'express';
import { documentReadService } from '../application/documents/documentReadService.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';

const UuidSchema = z.string().uuid();
const PaginationSchema = z.object({
  page: z.string().optional().default('1').transform(val => Math.max(1, parseInt(val, 10) || 1)),
  pageSize: z.string().optional().default('20').transform(val => Math.min(100, Math.max(1, parseInt(val, 10) || 20)))
});

export const documentReadController = {
  async getDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const docId = UuidSchema.parse(req.params.documentId);
      const doc = await documentReadService.getDocument(docId);
      res.json(doc);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return next(new AppError(400, 'VALIDATION_FAILED', 'Malformed document ID'));
      }
      next(err);
    }
  },

  async getOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const docId = UuidSchema.parse(req.params.documentId);
      const overview = await documentReadService.getDocumentOverview(docId);
      res.json(overview);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return next(new AppError(400, 'VALIDATION_FAILED', 'Malformed document ID'));
      }
      next(err);
    }
  },

  async getClauses(req: Request, res: Response, next: NextFunction) {
    try {
      const docId = UuidSchema.parse(req.params.documentId);
      const { page, pageSize } = PaginationSchema.parse(req.query);
      const clauses = await documentReadService.getDocumentClauses(docId, page, pageSize);
      res.json(clauses);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return next(new AppError(400, 'VALIDATION_FAILED', 'Malformed parameters'));
      }
      next(err);
    }
  },

  async getClauseDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const docId = UuidSchema.parse(req.params.documentId);
      const clauseId = UuidSchema.parse(req.params.clauseId);
      const detail = await documentReadService.getClauseDetail(docId, clauseId);
      res.json(detail);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return next(new AppError(400, 'VALIDATION_FAILED', 'Malformed IDs'));
      }
      next(err);
    }
  },

  async getGotchas(req: Request, res: Response, next: NextFunction) {
    try {
      const docId = UuidSchema.parse(req.params.documentId);
      const gotchas = await documentReadService.getGotchas(docId);
      res.json(gotchas);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return next(new AppError(400, 'VALIDATION_FAILED', 'Malformed document ID'));
      }
      next(err);
    }
  },

  async getChecklist(req: Request, res: Response, next: NextFunction) {
    try {
      const docId = UuidSchema.parse(req.params.documentId);
      const checklist = await documentReadService.getChecklist(docId);
      res.json(checklist);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return next(new AppError(400, 'VALIDATION_FAILED', 'Malformed document ID'));
      }
      next(err);
    }
  },

  async getBrief(req: Request, res: Response, next: NextFunction) {
    try {
      const docId = UuidSchema.parse(req.params.documentId);
      const brief = await documentReadService.getBrief(docId);
      res.json(brief);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return next(new AppError(400, 'VALIDATION_FAILED', 'Malformed document ID'));
      }
      next(err);
    }
  }
};
