import { z } from 'zod';
import { ClauseTypeSchema } from './clause.js';

export const EmbeddingRequestSchema = z.object({
  text: z.string(),
  model: z.string()
});
export type EmbeddingRequest = z.infer<typeof EmbeddingRequestSchema>;

export const EmbeddingResultSchema = z.object({
  vector: z.array(z.number()),
  dimensions: z.number().int().positive(),
  model: z.string()
});
export type EmbeddingResult = z.infer<typeof EmbeddingResultSchema>;

export const BenchmarkClauseSchema = z.object({
  id: z.string().uuid(),
  category: ClauseTypeSchema,
  contract_family: z.string(),
  jurisdiction: z.string(),
  title: z.string(),
  standard_text: z.string(),
  plain_explanation: z.string(),
  risk_baseline: z.literal('Standard')
});
export type BenchmarkClause = z.infer<typeof BenchmarkClauseSchema>;

export const BenchmarkMatchSchema = z.object({
  benchmark_id: z.string().uuid(),
  cosine_similarity: z.number().min(-1).max(1),
  rank: z.number().int().positive()
});
export type BenchmarkMatch = z.infer<typeof BenchmarkMatchSchema>;

export const RetrievalResultSchema = z.object({
  clause_id: z.string().uuid(),
  classified_category: ClauseTypeSchema,
  matches: z.array(BenchmarkMatchSchema),
  is_benchmark_gap: z.boolean()
});
export type RetrievalResult = z.infer<typeof RetrievalResultSchema>;
