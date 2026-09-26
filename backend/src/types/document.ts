import { z } from 'zod';

export const DocumentStatusSchema = z.enum([
  'uploaded',
  'queued',
  'processing',
  'analyzed',
  'failed'
]);
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

export const DocumentMetadataSchema = z.object({
  filename: z.string(),
  file_size_bytes: z.number().int().positive(),
  mime_type: z.string(),
  jurisdiction: z.string(),
  document_type: z.string(),
  is_scanned: z.boolean()
});
export type DocumentMetadata = z.infer<typeof DocumentMetadataSchema>;

export const DocumentProcessingStateSchema = z.object({
  status: DocumentStatusSchema,
  progress_percentage: z.number().min(0).max(100),
  total_clauses: z.number().int().nonnegative().optional(),
  processed_clauses: z.number().int().nonnegative().optional(),
  error_message: z.string().optional()
});
export type DocumentProcessingState = z.infer<typeof DocumentProcessingStateSchema>;

export const DocumentArtifactSchema = z.object({
  id: z.string().uuid(),
  metadata: DocumentMetadataSchema,
  state: DocumentProcessingStateSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});
export type DocumentArtifact = z.infer<typeof DocumentArtifactSchema>;
