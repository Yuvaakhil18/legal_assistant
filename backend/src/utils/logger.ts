export interface LogMetadata {
  requestId?: string;
  documentId?: string;
  jobId?: string;
  modelId?: string;
  promptVersion?: string;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  latencyMs?: number;
  retryCount?: number;
  cacheHit?: boolean;
  retrievalSimilarity?: number;
  failureReason?: string;
  statusCode?: number;
  path?: string;
  method?: string;
  [key: string]: unknown;
}

// Strictly block dangerous keys containing sensitive legal text or PII
const SENSITIVE_KEYS = new Set([
  'raw_text',
  'rawtext',
  'tokenized_text',
  'clause_text',
  'clausetext',
  'proposed_text',
  'file',
  'buffer',
  'entity_map',
  'question',
  'answer',
  'ssn',
  'password'
]);

function sanitizeMetadata(meta: LogMetadata): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED_SENSITIVE_DATA]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeMetadata(value as LogMetadata);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

class StructuredLogger {
  private formatLog(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, meta?: LogMetadata): string {
    const timestamp = new Date().toISOString();
    const payload = {
      timestamp,
      level,
      message,
      ...(meta ? sanitizeMetadata(meta) : {})
    };
    return JSON.stringify(payload);
  }

  info(message: string, meta?: LogMetadata): void {
    console.log(this.formatLog('INFO', message, meta));
  }

  warn(message: string, meta?: LogMetadata): void {
    console.warn(this.formatLog('WARN', message, meta));
  }

  error(message: string, meta?: LogMetadata): void {
    console.error(this.formatLog('ERROR', message, meta));
  }

  debug(message: string, meta?: LogMetadata): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.formatLog('DEBUG', message, meta));
    }
  }
}

export const logger = new StructuredLogger();
