import { dbQuery } from '../db/connection.js';

export const documentReadRepository = {
  async getDocumentBase(documentId: string) {
    const text = `
      SELECT 
        id, filename, file_size_bytes, mime_type, document_type, jurisdiction,
        status, error_message, is_scanned, created_at, updated_at
      FROM documents
      WHERE id = $1
    `;
    const res = await dbQuery(text, [documentId]);
    return res.rows.length > 0 ? res.rows[0] : null;
  },

  async getDocumentOverview(documentId: string) {
    const text = `
      SELECT 
        id, filename, file_size_bytes, mime_type, document_type, jurisdiction,
        status, error_message, is_scanned, created_at, updated_at,
        total_clauses, standard_count, caution_count, unfavorable_count,
        overall_risk_score, executive_summary, key_findings
      FROM documents
      WHERE id = $1
    `;
    const res = await dbQuery(text, [documentId]);
    return res.rows.length > 0 ? res.rows[0] : null;
  },

  async getDocumentClauses(documentId: string, limit: number, offset: number) {
    const text = `
      SELECT 
        id, clause_index, section_number, title, raw_text, tokenized_text, 
        category, risk_level, confidence_score, deviation_summary, risk_factors, 
        is_novel_clause, matched_benchmark_id
      FROM clauses
      WHERE document_id = $1
      ORDER BY clause_index ASC
      LIMIT $2 OFFSET $3
    `;
    const res = await dbQuery(text, [documentId, limit, offset]);
    
    const countText = `SELECT COUNT(*) as total FROM clauses WHERE document_id = $1`;
    const countRes = await dbQuery(countText, [documentId]);
    const total = parseInt((countRes.rows[0] as any).total, 10);
    
    return { clauses: res.rows, total };
  },

  async getClauseDetail(clauseId: string, documentId: string) {
    const text = `
      SELECT 
        c.id, c.clause_index, c.section_number, c.title, c.raw_text, c.tokenized_text, 
        c.category, c.risk_level, c.confidence_score, c.deviation_summary, c.risk_factors, 
        c.is_novel_clause, c.matched_benchmark_id,
        b.title as benchmark_title, b.standard_text as benchmark_text, b.plain_explanation as benchmark_explanation, b.risk_baseline as benchmark_risk_baseline
      FROM clauses c
      LEFT JOIN benchmark_clauses b ON c.matched_benchmark_id = b.id
      WHERE c.id = $1 AND c.document_id = $2
    `;
    const res = await dbQuery(text, [clauseId, documentId]);
    return res.rows.length > 0 ? res.rows[0] : null;
  },

  async getGotchas(documentId: string) {
    const text = `
      SELECT id, priority, title, severity, impact_description, plain_english_advice, related_clause_ids
      FROM gotchas
      WHERE document_id = $1
      ORDER BY priority ASC
    `;
    const res = await dbQuery(text, [documentId]);
    return res.rows;
  },

  async getChecklist(documentId: string) {
    const text = `
      SELECT id, priority, item, category, status, impact_rationale
      FROM checklists
      WHERE document_id = $1
      ORDER BY priority ASC
    `;
    const res = await dbQuery(text, [documentId]);
    return res.rows;
  },

  async getAttorneyBriefs(documentId: string) {
    const text = `
      SELECT id, priority, clause_ref, question, context_summary
      FROM attorney_briefs
      WHERE document_id = $1
      ORDER BY priority ASC
    `;
    const res = await dbQuery(text, [documentId]);
    return res.rows;
  }
};
