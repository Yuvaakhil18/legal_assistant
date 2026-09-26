export interface DocumentMetadata {
  document_id: string;
  filename: string;
  document_type: string;
  detected_jurisdiction: string;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  created_at: string;
}

export interface Clause {
  clause_id: string;
  section_number: string;
  title: string;
  raw_text: string;
}

export type RiskLevel = 'Standard' | 'Caution' | 'Unfavorable';

export interface RiskAssessment {
  clause_id: string;
  risk_level: RiskLevel;
  primary_category: string;
  delta?: {
    deviation_summary: string;
    risk_factors: string[];
  };
  is_novel_clause: boolean;
  benchmark_id?: string;
  benchmark_title?: string;
}

export interface Gotcha {
  priority: number;
  title: string;
  severity: 'Critical' | 'High' | 'Moderate' | 'Low';
  impact_description: string;
  plain_english_advice: string;
  related_clause_ids: string[];
}

export interface ChecklistItem {
  item: string;
  category: string;
  status: 'Action Required' | 'Verified' | 'Optional';
}

export interface AttorneyConsultationQuestion {
  clause_ref: string;
  question: string;
  context_summary: string;
}

export interface ConsolidatedAuditPacket {
  document_id: string;
  executive_summary: string;
  key_findings: string[];
  top_gotchas: Gotcha[];
  pre_signing_checklist: ChecklistItem[];
  attorney_consultation_questions: AttorneyConsultationQuestion[];
}

export interface CounterDraft {
  clause_id: string;
  proposed_text: string;
  key_modifications: string[];
  negotiation_talking_point: string;
}

export interface QueryResponse {
  document_id: string;
  question: string;
  answer: string;
  grounding_citations: Array<{
    clause_id: string;
    section_number: string;
    title: string;
    relevance_score: number;
  }>;
  suggested_follow_ups: string[];
}
