import { z } from 'zod';

export const ClauseTypeSchema = z.enum([
  'Indemnification',
  'Limitation of Liability',
  'Termination',
  'Non-Compete',
  'IP Assignment',
  'Confidentiality',
  'Payment Terms',
  'Dispute Resolution',
  'General',
  'Novel'
]);
export type ClauseType = z.infer<typeof ClauseTypeSchema>;

export const ClauseLocationSchema = z.object({
  clause_index: z.number().int().nonnegative(),
  section_number: z.string().optional(),
  title: z.string().optional()
});
export type ClauseLocation = z.infer<typeof ClauseLocationSchema>;

export const ClauseSchema = z.object({
  raw_text: z.string(),
  tokenized_text: z.string(),
  sha256: z.string().length(64)
});
export type Clause = z.infer<typeof ClauseSchema>;

export const ClauseArtifactSchema = z.object({
  id: z.string().uuid(),
  document_id: z.string().uuid(),
  location: ClauseLocationSchema,
  content: ClauseSchema,
  category: ClauseTypeSchema.optional(),
  is_novel_clause: z.boolean().default(false),
  created_at: z.string().datetime()
});
export type ClauseArtifact = z.infer<typeof ClauseArtifactSchema>;
