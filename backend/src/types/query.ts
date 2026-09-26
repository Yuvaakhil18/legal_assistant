import { z } from 'zod';

export const DocumentQuerySchema = z.object({
  document_id: z.string().uuid(),
  question: z.string(),
  session_id: z.string().optional()
});
export type DocumentQuery = z.infer<typeof DocumentQuerySchema>;

export const QueryCitationSchema = z.object({
  clause_id: z.string().uuid(),
  section_number: z.string().optional(),
  title: z.string().optional(),
  relevance_score: z.number().min(0).max(1)
});
export type QueryCitation = z.infer<typeof QueryCitationSchema>;

export const QueryResponseSchema = z.object({
  document_id: z.string().uuid(),
  question: z.string(),
  answer: z.string(),
  grounding_citations: z.array(QueryCitationSchema),
  suggested_follow_ups: z.array(z.string()).default([]),
  metrics: z.object({
    prompt_tokens: z.number().int().nonnegative(),
    completion_tokens: z.number().int().nonnegative()
  }).optional()
});
export type QueryResponse = z.infer<typeof QueryResponseSchema>;
