export * from './document.js';
export * from './clause.js';
export * from './retrieval.js';
export * from './risk.js';
export * from './legal.js';
export * from './query.js';
export * from './jobs.js';

// Standard API Response Envelope
export interface ApiResponse<T> {
  success: true;
  data: T;
  disclaimer: string;
  request_id: string;
  timestamp: string;
}

// Standard API Error Envelope
export interface ApiErrorResponse {
  success: false;
  error: {
    code: StandardErrorCode;
    message: string;
    details?: unknown;
  };
  disclaimer: string;
  request_id: string;
  timestamp: string;
}

export type StandardErrorCode =
  | 'VALIDATION_FAILED'
  | 'INVALID_FILE_FORMAT'
  | 'FILE_TOO_LARGE'
  | 'DOCUMENT_NOT_FOUND'
  | 'CLAUSE_NOT_FOUND'
  | 'DOCUMENT_REQUIRES_OCR'
  | 'EXTRACTION_FAILED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'AI_SERVICE_UNAVAILABLE'
  | 'INTERNAL_SERVER_ERROR';

export const MANDATORY_LEGAL_DISCLAIMER =
  'This platform provides automated informational analysis for educational review. It does not provide legal advice, does not create an attorney-client relationship, and cannot replace formal legal consultation with licensed counsel.';
