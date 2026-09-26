import { dbQuery } from '../db/connection.js';

export const counterDraftRepository = {
  async saveCounterDraft(clauseId: string, proposedText: string, keyModifications: string[], negotiationTalkingPoint: string): Promise<{ id: string }> {
    const sql = `
      INSERT INTO counter_drafts (clause_id, proposed_text, key_modifications, negotiation_talking_point, status)
      VALUES ($1, $2, $3, $4, 'generated')
      RETURNING id
    `;
    const res = await dbQuery(sql, [clauseId, proposedText, JSON.stringify(keyModifications), negotiationTalkingPoint]);
    return { id: (res.rows[0] as any).id };
  },

  async getCounterDraftByClauseId(clauseId: string) {
    const sql = `SELECT id, clause_id, proposed_text, key_modifications, negotiation_talking_point, status, created_at FROM counter_drafts WHERE clause_id = $1 ORDER BY created_at DESC LIMIT 1`;
    const res = await dbQuery(sql, [clauseId]);
    return res.rows.length > 0 ? res.rows[0] : null;
  },

  async saveDocumentQA(documentId: string, question: string, answer: string, citations: unknown[], followUps: string[], promptTokens: number, completionTokens: number): Promise<{ id: string }> {
    const sql = `
      INSERT INTO document_qas (document_id, question, answer, grounding_citations, suggested_follow_ups, prompt_tokens, completion_tokens)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;
    const res = await dbQuery(sql, [documentId, question, answer, JSON.stringify(citations), JSON.stringify(followUps), promptTokens, completionTokens]);
    return { id: (res.rows[0] as any).id };
  }
};
