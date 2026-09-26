import { z } from 'zod';

export const GotchaSchema = z.object({
  id: z.string().uuid().optional(),
  priority: z.number().int().positive(),
  title: z.string(),
  severity: z.enum(['Critical', 'High', 'Moderate']),
  impact_description: z.string(),
  plain_english_advice: z.string(),
  related_clause_ids: z.array(z.string().uuid())
});
export type Gotcha = z.infer<typeof GotchaSchema>;

export const ChecklistItemSchema = z.object({
  id: z.string().uuid().optional(),
  priority: z.number().int().positive(),
  item: z.string(),
  category: z.string(),
  status: z.enum(['Action Required', 'Verified', 'Optional']),
  impact_rationale: z.string()
});
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

export const AttorneyConsultationQuestionSchema = z.object({
  id: z.string().uuid().optional(),
  priority: z.number().int().positive(),
  clause_ref: z.string(),
  question: z.string(),
  context_summary: z.string()
});
export type AttorneyConsultationQuestion = z.infer<typeof AttorneyConsultationQuestionSchema>;

export const ConsolidatedAuditPacketSchema = z.object({
  document_id: z.string().uuid(),
  executive_summary: z.string(),
  key_findings: z.array(z.string()),
  top_gotchas: z.array(GotchaSchema),
  pre_signing_checklist: z.array(ChecklistItemSchema),
  attorney_consultation_questions: z.array(AttorneyConsultationQuestionSchema)
});
export type ConsolidatedAuditPacket = z.infer<typeof ConsolidatedAuditPacketSchema>;

export const CounterDraftSchema = z.object({
  id: z.string().uuid().optional(),
  clause_id: z.string().uuid(),
  proposed_text: z.string(),
  key_modifications: z.array(z.string()),
  negotiation_talking_point: z.string(),
  status: z.enum(['generated', 'copied', 'exported']).default('generated')
});
export type CounterDraft = z.infer<typeof CounterDraftSchema>;

export const GuardrailResultSchema = z.object({
  is_compliant: z.boolean(),
  sanitized_content: z.string().optional(),
  flagged_reasons: z.array(z.string()).optional()
});
export type GuardrailResult = z.infer<typeof GuardrailResultSchema>;
