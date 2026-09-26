import { documentReadRepository } from '../../repositories/documentReadRepository.js';
import { counterDraftRepository } from '../../repositories/counterDraftRepository.js';
import { LegalIntelligenceService } from '../../services/legal/legalService.js';
import { QueryService } from '../../services/query/queryService.js';
import { AppError } from '../../middleware/errorHandler.js';
import { MANDATORY_LEGAL_DISCLAIMER } from '../../types/contracts.js';
import { CounterDraft } from '../../types/legal.js';
import { QueryResponse } from '../../types/query.js';
import { logger } from '../../utils/logger.js';

const legalService = new LegalIntelligenceService();
const queryService = new QueryService();

export const interactiveService = {
  async generateCounterDraft(documentId: string, clauseId: string): Promise<CounterDraft & { disclaimer: string }> {
    // Verify clause belongs to document
    const clause = await documentReadRepository.getClauseDetail(clauseId, documentId);
    if (!clause) {
      throw new AppError(404, 'CLAUSE_NOT_FOUND', 'Clause not found for this document');
    }
    const c: any = clause;

    const riskFactors = typeof c.risk_factors === 'string' ? JSON.parse(c.risk_factors) : (c.risk_factors || []);
    const category = c.category || 'General';

    const draft = await legalService.generateCounterDraft(
      clauseId,
      c.raw_text,
      category,
      riskFactors
    );

    // Persist
    try {
      await counterDraftRepository.saveCounterDraft(
        clauseId,
        draft.proposed_text,
        draft.key_modifications,
        draft.negotiation_talking_point
      );
    } catch (err) {
      logger.error('Failed to persist counter-draft', { clauseId });
      // Non-fatal: still return the draft
    }

    return {
      ...draft,
      disclaimer: MANDATORY_LEGAL_DISCLAIMER
    };
  },

  async answerQuestion(documentId: string, question: string): Promise<QueryResponse & { disclaimer: string }> {
    // Verify document exists
    const doc = await documentReadRepository.getDocumentBase(documentId);
    if (!doc) {
      throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
    }

    const response = await queryService.answerQuestion({
      document_id: documentId,
      question
    });

    // Persist Q&A
    try {
      await counterDraftRepository.saveDocumentQA(
        documentId,
        question,
        response.answer,
        response.grounding_citations,
        response.suggested_follow_ups,
        response.metrics?.prompt_tokens || 0,
        response.metrics?.completion_tokens || 0
      );
    } catch (err) {
      logger.error('Failed to persist Q&A', { documentId });
      // Non-fatal
    }

    return {
      ...response,
      disclaimer: MANDATORY_LEGAL_DISCLAIMER
    };
  }
};
