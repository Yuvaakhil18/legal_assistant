import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiErrorResponse, StandardErrorCode, MANDATORY_LEGAL_DISCLAIMER } from '../types/contracts.js';
import { logger } from '../utils/logger.js';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: StandardErrorCode;
  public readonly details?: unknown;

  constructor(statusCode: number, errorCode: StandardErrorCode, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorHandler(
  err: Error | AppError | ZodError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.requestId || 'unknown';

  let statusCode = 500;
  let errorCode: StandardErrorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected internal error occurred.';
  let details: unknown = undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorCode = err.errorCode;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    errorCode = 'VALIDATION_FAILED';
    message = 'Request validation failed.';
    details = err.flatten();
  }

  logger.error(message, {
    requestId,
    statusCode,
    errorCode,
    path: req.path,
    method: req.method,
    failureReason: err.message
  });

  const errorResponse: ApiErrorResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
      ...(details ? { details } : {})
    },
    disclaimer: MANDATORY_LEGAL_DISCLAIMER,
    request_id: requestId,
    timestamp: new Date().toISOString()
  };

  res.status(statusCode).json(errorResponse);
}
