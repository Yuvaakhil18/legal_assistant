import { dbQuery } from '../db/connection.js';
import { ClauseArtifact, ConsolidatedAuditPacket } from '../types/contracts.js';

export const analysisRepository = {
  async upsertClauses(clauses: ClauseArtifact[]): Promise<void> {
    if (clauses.length === 0) return;
    
    // We do this individually for simplicity, though batching is possible
    for (const clause of clauses) {
      const sql = `
        INSERT INTO clauses (
          id, document_id, clause_index, section_number, title, 
          raw_text, tokenized_text, sha256, category, risk_level, 
          confidence_score, deviation_summary, risk_factors, 
          is_novel_clause, matched_benchmark_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (id) DO UPDATE SET
          category = EXCLUDED.category,
          risk_level = EXCLUDED.risk_level,
          confidence_score = EXCLUDED.confidence_score,
          deviation_summary = EXCLUDED.deviation_summary,
          risk_factors = EXCLUDED.risk_factors,
          is_novel_clause = EXCLUDED.is_novel_clause,
          matched_benchmark_id = EXCLUDED.matched_benchmark_id
      `;
      const values = [
        clause.id,
        clause.document_id,
        clause.location.clause_index,
        clause.location.section_number || null,
        clause.location.title || null,
        clause.content.raw_text,
        clause.content.tokenized_text,
        clause.content.sha256,
        clause.category || null,
        (clause as any).risk_level || 'Standard',
        (clause as any).confidence_score || 0.00,
        (clause as any).delta?.deviation_summary || null,
        JSON.stringify((clause as any).delta?.risk_factors || []),
        clause.is_novel_clause || false,
        (clause as any).matched_benchmark_id || null
      ];
      await dbQuery(sql, values);
    }
  },

  async upsertClauseBenchmarks(clauseId: string, matches: { benchmark_id: string; cosine_similarity: number; rank: number }[]): Promise<void> {
    for (const match of matches) {
      const sql = `
        INSERT INTO clause_benchmarks (clause_id, benchmark_id, cosine_similarity, rank)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (clause_id, rank) DO UPDATE SET
          benchmark_id = EXCLUDED.benchmark_id,
          cosine_similarity = EXCLUDED.cosine_similarity
      `;
      await dbQuery(sql, [clauseId, match.benchmark_id, match.cosine_similarity, match.rank]);
    }
  },

  async upsertConsolidatedAudit(documentId: string, packet: ConsolidatedAuditPacket): Promise<void> {
    // Upsert Document Executive Summary
    const updateDocSql = `
      UPDATE documents 
      SET executive_summary = $1, key_findings = $2 
      WHERE id = $3
    `;
    await dbQuery(updateDocSql, [packet.executive_summary, JSON.stringify(packet.key_findings || []), documentId]);

    // Clear existing to avoid duplicate accumulation on retry
    await dbQuery(`DELETE FROM gotchas WHERE document_id = $1`, [documentId]);
    await dbQuery(`DELETE FROM checklists WHERE document_id = $1`, [documentId]);
    await dbQuery(`DELETE FROM attorney_briefs WHERE document_id = $1`, [documentId]);

    // Insert Gotchas
    if (packet.top_gotchas?.length) {
      for (const g of packet.top_gotchas) {
        const sql = `
          INSERT INTO gotchas (document_id, priority, title, severity, impact_description, plain_english_advice, related_clause_ids)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;
        await dbQuery(sql, [documentId, g.priority, g.title, g.severity, g.impact_description, g.plain_english_advice, JSON.stringify(g.related_clause_ids || [])]);
      }
    }

    // Insert Checklists
    if (packet.pre_signing_checklist?.length) {
      for (let i = 0; i < packet.pre_signing_checklist.length; i++) {
        const c = packet.pre_signing_checklist[i];
        const sql = `
          INSERT INTO checklists (document_id, priority, item, category, status, impact_rationale)
          VALUES ($1, $2, $3, $4, $5, $6)
        `;
        await dbQuery(sql, [documentId, i + 1, c.item, c.category, c.status, c.impact_rationale || 'N/A']);
      }
    }

    // Insert Attorney Questions
    if (packet.attorney_consultation_questions?.length) {
      for (let i = 0; i < packet.attorney_consultation_questions.length; i++) {
        const q = packet.attorney_consultation_questions[i];
        const sql = `
          INSERT INTO attorney_briefs (document_id, priority, clause_ref, question, context_summary)
          VALUES ($1, $2, $3, $4, $5)
        `;
        await dbQuery(sql, [documentId, i + 1, q.clause_ref, q.question, q.context_summary || 'N/A']);
      }
    }
  },

  async completeDocumentProcessing(documentId: string, totals: { standard: number; caution: number; unfavorable: number }): Promise<void> {
    const total = totals.standard + totals.caution + totals.unfavorable;
    const sql = `
      UPDATE documents
      SET status = 'analyzed',
          total_clauses = $1,
          standard_count = $2,
          caution_count = $3,
          unfavorable_count = $4,
          updated_at = NOW()
      WHERE id = $5
    `;
    await dbQuery(sql, [total, totals.standard, totals.caution, totals.unfavorable, documentId]);
  }
};
