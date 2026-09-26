import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env if present
dotenv.config();

export const EnvSchema = z.object({
  // Server & Environment
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Storage Connections
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5433/legal_intel'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  USE_IN_MEMORY_FALLBACK: z.preprocess((val) => {
    if (typeof val === 'string') return val.toLowerCase() === 'true';
    if (typeof val === 'boolean') return val;
    return true;
  }, z.boolean().default(true)),

  // AI & Model Configuration
  GEMINI_API_KEY: z.string().default('test_mock_gemini_key_for_development'),
  MODEL_REASONING: z.string().default('gemini-3.8-flash'),
  MODEL_REASONING_FALLBACK: z.string().default('gemini-3.5-flash'),
  MODEL_EMBEDDING: z.string().default('gemini-embedding-2'),
  EMBEDDING_DIMENSIONS: z.coerce.number().default(768),

  // Retrieval & Scoring Calibration (evaluation-driven, non-constant)
  SIMILARITY_THRESHOLD_HIGH_RISK: z.coerce.number().default(0.72),
  SIMILARITY_THRESHOLD_DEFAULT: z.coerce.number().default(0.65),
  RETRIEVAL_TOP_K: z.coerce.number().default(3),

  // Queue & Safety Constraints
  MAX_FILE_SIZE_MB: z.coerce.number().default(5),
  RATE_LIMIT_RPM: z.coerce.number().default(60),
  ANALYSIS_WORKER_CONCURRENCY: z.coerce.number().default(4),
  ANALYSIS_JOB_MAX_RETRIES: z.coerce.number().default(3)
});

export type EnvConfig = z.infer<typeof EnvSchema>;

let parsedConfig: EnvConfig | null = null;

export function getEnvConfig(): EnvConfig {
  if (!parsedConfig) {
    const result = EnvSchema.safeParse(process.env);
    if (!result.success) {
      console.error('❌ Configuration validation failed:', JSON.stringify(result.error.format(), null, 2));
      throw new Error(`Invalid environment configuration: ${JSON.stringify(result.error.flatten().fieldErrors)}`);
    }
    parsedConfig = result.data;
  }
  return parsedConfig;
}

export const env = getEnvConfig();
