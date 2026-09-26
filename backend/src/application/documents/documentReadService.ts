import { documentReadRepository } from '../../repositories/documentReadRepository.js';
import { AppError } from '../../middleware/errorHandler.js';
import { 
  DocumentArtifact, DocumentProcessingState, 
  RiskAssessment, Gotcha, ChecklistItem, AttorneyConsultationQuestion, 
  ConsolidatedAuditPacket, MANDATORY_LEGAL_DISCLAIMER 
} from '../../types/contracts.js';
import { z } from 'zod';

export const documentReadService = {
  async getDocument(documentId: string) {
    const _doc = await documentReadRepository.getDocumentBase(documentId);
    if (!_doc) {
      throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
    }
    const doc: any = _doc;
    
    return {
      document_id: doc.id,
      filename: doc.filename,
      file_size_bytes: doc.file_size_bytes,
      mime_type: doc.mime_type,
      document_type: doc.document_type,
      jurisdiction: doc.jurisdiction,
      is_scanned: doc.is_scanned,
      status: doc.status,
      error_message: doc.error_message,
      created_at: doc.created_at,
      updated_at: doc.updated_at
    };
  },

  async getDocumentOverview(documentId: string) {
    const _doc = await documentReadRepository.getDocumentOverview(documentId);
    if (!_doc) {
      throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
    }
    const doc: any = _doc;

    return {
      metadata: {
        document_id: doc.id,
        filename: doc.filename,
        document_type: doc.document_type,
        jurisdiction: doc.jurisdiction,
        is_scanned: doc.is_scanned
      },
      state: {
        status: doc.status,
        error_message: doc.error_message,
        total_clauses: doc.total_clauses,
        standard_count: doc.standard_count,
        caution_count: doc.caution_count,
        unfavorable_count: doc.unfavorable_count,
        overall_risk_score: parseFloat(doc.overall_risk_score) || 0
      },
      executive_summary: doc.executive_summary,
      key_findings: typeof doc.key_findings === 'string' ? JSON.parse(doc.key_findings) : doc.key_findings,
      disclaimer: MANDATORY_LEGAL_DISCLAIMER
    };
  },

  async getDocumentClauses(documentId: string, page: number, pageSize: number) {
    const _doc = await documentReadRepository.getDocumentBase(documentId);
    if (!_doc) {
      throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
    }

    const limit = pageSize;
    const offset = (page - 1) * pageSize;
    const { clauses, total } = await documentReadRepository.getDocumentClauses(documentId, limit, offset);

    const mapped = (clauses as any[]).map(c => ({
      clause_id: c.id,
      clause_index: c.clause_index,
      section_number: c.section_number,
      title: c.title,
      raw_text: c.raw_text,
      risk_assessment: {
        clause_id: c.id,
        risk_level: c.risk_level,
        confidence_score: parseFloat(c.confidence_score) || 0,
        primary_category: c.category,
        is_novel_clause: c.is_novel_clause,
        delta: {
          deviation_summary: c.deviation_summary,
          risk_factors: typeof c.risk_factors === 'string' ? JSON.parse(c.risk_factors) : (c.risk_factors || [])
        }
      } as RiskAssessment
    }));

    return {
      clauses: mapped,
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: Math.ceil(total / pageSize)
      }
    };
  },

  async getClauseDetail(documentId: string, clauseId: string) {
    const _c = await documentReadRepository.getClauseDetail(clauseId, documentId);
    if (!_c) {
      throw new AppError(404, 'CLAUSE_NOT_FOUND', 'Clause not found for this document');
    }
    const c: any = _c;

    return {
      clause_id: c.id,
      clause_index: c.clause_index,
      section_number: c.section_number,
      title: c.title,
      raw_text: c.raw_text,
      risk_assessment: {
        clause_id: c.id,
        risk_level: c.risk_level,
        confidence_score: parseFloat(c.confidence_score) || 0,
        primary_category: c.category,
        is_novel_clause: c.is_novel_clause,
        delta: {
          deviation_summary: c.deviation_summary,
          risk_factors: typeof c.risk_factors === 'string' ? JSON.parse(c.risk_factors) : (c.risk_factors || [])
        }
      } as RiskAssessment,
      benchmark: c.matched_benchmark_id ? {
        id: c.matched_benchmark_id,
        title: c.benchmark_title,
        text: c.benchmark_text,
        explanation: c.benchmark_explanation,
        risk_baseline: c.benchmark_risk_baseline
      } : null
    };
  },

  async getGotchas(documentId: string): Promise<Gotcha[]> {
    const doc = await documentReadRepository.getDocumentBase(documentId);
    if (!doc) {
      throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
    }

    const rows = await documentReadRepository.getGotchas(documentId);
    return (rows as any[]).map(r => ({
      id: r.id,
      priority: r.priority,
      title: r.title,
      severity: r.severity,
      impact_description: r.impact_description,
      plain_english_advice: r.plain_english_advice,
      related_clause_ids: typeof r.related_clause_ids === 'string' ? JSON.parse(r.related_clause_ids) : (r.related_clause_ids || [])
    }));
  },

  async getChecklist(documentId: string): Promise<ChecklistItem[]> {
    const doc = await documentReadRepository.getDocumentBase(documentId);
    if (!doc) {
      throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
    }

    const rows = await documentReadRepository.getChecklist(documentId);
    return (rows as any[]).map(r => ({
      id: r.id,
      priority: r.priority,
      item: r.item,
      category: r.category,
      status: r.status,
      impact_rationale: r.impact_rationale
    }));
  },

  async getBrief(documentId: string): Promise<ConsolidatedAuditPacket> {
    const _doc = await documentReadRepository.getDocumentOverview(documentId);
    if (!_doc) {
      throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
    }
    const doc: any = _doc;

    const gotchas = await this.getGotchas(documentId);
    const checklist = await this.getChecklist(documentId);
    const briefs = await documentReadRepository.getAttorneyBriefs(documentId);
    const questions = (briefs as any[]).map(r => ({
      id: r.id,
      priority: r.priority,
      clause_ref: r.clause_ref,
      question: r.question,
      context_summary: r.context_summary
    }));

    return {
      document_id: documentId,
      executive_summary: doc.executive_summary || '',
      key_findings: typeof doc.key_findings === 'string' ? JSON.parse(doc.key_findings) : (doc.key_findings || []),
      top_gotchas: gotchas,
      pre_signing_checklist: checklist,
      attorney_consultation_questions: questions
    };
  }
};
