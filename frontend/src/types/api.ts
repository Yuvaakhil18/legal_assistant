export type DocumentStatus = 'uploaded' | 'queued' | 'processing' | 'analyzed' | 'failed';
export type RiskLevel = 'Standard' | 'Caution' | 'Unfavorable';
export type Jurisdiction = 'General Commercial' | 'US-General' | 'US-CA' | 'US-NY' | 'UK' | 'India';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  disclaimer: string;
  request_id: string;
  timestamp: string;
}

export interface HealthCheckData {
  status: string;
  version: string;
  architecture: string;
  uptime_seconds: number;
  database: {
    connected: boolean;
    provider: string;
    is_fallback: boolean;
  };
  cache: {
    connected: boolean;
    provider: string;
    is_fallback: boolean;
  };
  queue: {
    status: string;
    queue_name: string;
    is_fallback: boolean;
  };
  ai_engine: {
    provider: string;
    model_reasoning: string;
    model_embedding: string;
    embedding_dimensions: number;
  };
}
