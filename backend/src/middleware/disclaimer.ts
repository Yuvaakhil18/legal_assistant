import { Request, Response, NextFunction } from 'express';
import { MANDATORY_LEGAL_DISCLAIMER } from '../types/contracts.js';

export function disclaimerMiddleware(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Legal-Disclaimer', 'Automated AI analysis for informational purposes only. Not legal advice.');
  next();
}

export function createSuccessEnvelope<T>(req: Request, data: T) {
  return {
    success: true as const,
    data,
    disclaimer: MANDATORY_LEGAL_DISCLAIMER,
    request_id: req.requestId || 'unknown',
    timestamp: new Date().toISOString()
  };
}
