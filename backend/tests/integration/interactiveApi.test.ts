import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { documentReadRepository } from '../../src/repositories/documentReadRepository.js';
import { counterDraftRepository } from '../../src/repositories/counterDraftRepository.js';
import { LegalIntelligenceService } from '../../src/services/legal/legalService.js';
import { QueryService } from '../../src/services/query/queryService.js';

vi.mock('../../src/repositories/documentReadRepository.js');
vi.mock('../../src/repositories/counterDraftRepository.js');
vi.mock('../../src/services/legal/legalService.js');
vi.mock('../../src/services/query/queryService.js');

describe('Interactive API Integration', () => {
  const mockDocId = '123e4567-e89b-12d3-a456-426614174000';
  const mockClauseId = '223e4567-e89b-12d3-a456-426614174001';

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /api/documents/:documentId/clauses/:clauseId/counter-draft', () => {
    it('should generate counter-draft for valid clause', async () => {
      vi.mocked(documentReadRepository.getClauseDetail).mockResolvedValue({
        id: mockClauseId,
        raw_text: 'Test clause text',
        category: 'Indemnification',
        risk_factors: '["Factor 1"]',
        risk_level: 'Unfavorable'
      } as any);

      vi.mocked(LegalIntelligenceService.prototype.generateCounterDraft).mockResolvedValue({
        clause_id: mockClauseId,
        proposed_text: 'Sample / educational language - not legal advice.\n\nBetter clause text.',
        key_modifications: ['Made mutual'],
        negotiation_talking_point: 'Standard practice.',
        status: 'generated'
      });

      vi.mocked(counterDraftRepository.saveCounterDraft).mockResolvedValue({ id: 'draft-1' });

      const res = await request(app)
        .post(`/api/documents/${mockDocId}/clauses/${mockClauseId}/counter-draft`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.clause_id).toBe(mockClauseId);
      expect(res.body.proposed_text).toContain('educational');
      expect(res.body.disclaimer).toBeDefined();
    });

    it('should return 404 for clause not in document', async () => {
      vi.mocked(documentReadRepository.getClauseDetail).mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/documents/${mockDocId}/clauses/${mockClauseId}/counter-draft`)
        .send();

      expect(res.status).toBe(404);
    });

    it('should return 400 for malformed IDs', async () => {
      const res = await request(app)
        .post(`/api/documents/invalid/clauses/invalid/counter-draft`)
        .send();

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/documents/:documentId/query', () => {
    it('should answer valid question', async () => {
      vi.mocked(documentReadRepository.getDocumentBase).mockResolvedValue({ id: mockDocId } as any);

      vi.mocked(QueryService.prototype.answerQuestion).mockResolvedValue({
        document_id: mockDocId,
        question: 'What about indemnification?',
        answer: 'Based on Section 8.1, the indemnification clause is unilateral.\n\n[DISCLAIMER: This information is provided for educational and informational purposes only. It is not legal advice, nor does it create an attorney-client relationship. You should consult a qualified attorney for advice regarding your specific situation.]',
        grounding_citations: [
          { clause_id: mockClauseId, section_number: '8.1', title: 'Indemnification', relevance_score: 0.95 }
        ],
        suggested_follow_ups: ['What is the cap?']
      });

      vi.mocked(counterDraftRepository.saveDocumentQA).mockResolvedValue({ id: 'qa-1' });

      const res = await request(app)
        .post(`/api/documents/${mockDocId}/query`)
        .send({ question: 'What about indemnification?' });

      expect(res.status).toBe(200);
      expect(res.body.answer).toBeDefined();
      expect(res.body.grounding_citations).toHaveLength(1);
      expect(res.body.disclaimer).toBeDefined();
    });

    it('should return 404 for missing document', async () => {
      vi.mocked(documentReadRepository.getDocumentBase).mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/documents/${mockDocId}/query`)
        .send({ question: 'Test question' });

      expect(res.status).toBe(404);
    });

    it('should return 400 for empty question', async () => {
      const res = await request(app)
        .post(`/api/documents/${mockDocId}/query`)
        .send({ question: '' });

      expect(res.status).toBe(400);
    });

    it('should return 400 for missing question', async () => {
      const res = await request(app)
        .post(`/api/documents/${mockDocId}/query`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 400 for malformed document ID', async () => {
      const res = await request(app)
        .post(`/api/documents/invalid-uuid/query`)
        .send({ question: 'Test' });

      expect(res.status).toBe(400);
    });
  });
});
