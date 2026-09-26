import { z } from 'zod';

export const RiskLevelSchema = z.enum(['Standard', 'Caution', 'Unfavorable']);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const EvidenceReferenceSchema = z.object({
  quote: z.string(),
  reasoning: z.string()
});
export type EvidenceReference = z.infer<typeof EvidenceReferenceSchema>;

export const SemanticDeltaSchema = z.object({
  deviation_summary: z.string(),
  risk_factors: z.array(z.string()),
  evidence: z.array(EvidenceReferenceSchema).optional()
});
export type SemanticDelta = z.infer<typeof SemanticDeltaSchema>;

export const RiskAssessmentSchema = z.object({
  clause_id: z.string().uuid(),
  risk_level: RiskLevelSchema,
  confidence_score: z.number().min(0).max(1),
  primary_category: z.string(),
  delta: SemanticDeltaSchema.optional(),
  is_novel_clause: z.boolean()
});
export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;
