import { z } from 'zod';

export const JobStatusSchema = z.enum([
  'pending',
  'active',
  'completed',
  'failed',
  'delayed',
  'waiting_children'
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const AnalysisJobSchema = z.object({
  job_id: z.string(),
  document_id: z.string().uuid(),
  jurisdiction: z.string(),
  document_type: z.string(),
  priority: z.number().int().default(0)
});
export type AnalysisJob = z.infer<typeof AnalysisJobSchema>;

export const JobResultSchema = z.object({
  job_id: z.string(),
  status: JobStatusSchema,
  result_data: z.unknown().optional(),
  error: z.object({
    message: z.string(),
    code: z.string().optional()
  }).optional(),
  duration_ms: z.number().int().nonnegative().optional(),
  processed_at: z.string().datetime().optional()
});
export type JobResult = z.infer<typeof JobResultSchema>;
