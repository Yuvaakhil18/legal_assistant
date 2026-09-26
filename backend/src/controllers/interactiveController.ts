import { Request, Response, NextFunction } from 'express';
import { interactiveService } from '../application/documents/interactiveService.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';

const UuidSchema = z.string().uuid();
const QuestionSchema = z.object({
  question: z.string().min(1).max(2000)
});

export const interactiveController = {
  async generateCounterDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const docId = UuidSchema.parse(req.params.documentId);
      const clauseId = UuidSchema.parse(req.params.clauseId);
      const draft = await interactiveService.generateCounterDraft(docId, clauseId);
      res.json(draft);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return next(new AppError(400, 'VALIDATION_FAILED', 'Malformed IDs'));
      }
      next(err);
    }
  },

  async askQuestion(req: Request, res: Response, next: NextFunction) {
    try {
      const docId = UuidSchema.parse(req.params.documentId);
      const { question } = QuestionSchema.parse(req.body);
      const response = await interactiveService.answerQuestion(docId, question);
      res.json(response);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return next(new AppError(400, 'VALIDATION_FAILED', 'Invalid request parameters'));
      }
      next(err);
    }
  }
};
