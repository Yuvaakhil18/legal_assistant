import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { documentReadRepository } from '../../src/repositories/documentReadRepository.js';

vi.mock('../../src/repositories/documentReadRepository.js');

describe('Document Read API Integration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const mockDocId = '123e4567-e89b-12d3-a456-426614174000';
  const mockClauseId = '223e4567-e89b-12d3-a456-426614174001';

  describe('GET /api/documents/:documentId', () => {
    it('should return valid document', async () => {
      vi.mocked(documentReadRepository.getDocumentBase).mockResolvedValue({
        id: mockDocId,
        filename: 'test.pdf',
        file_size_bytes: 100,
        mime_type: 'application/pdf',
        document_type: 'contract',
        jurisdiction: 'US',
        status: 'analyzed',
        is_scanned: false,
        created_at: new Date(),
        updated_at: new Date()
      });

      const res = await request(app).get(`/api/documents/${mockDocId}`);
      expect(res.status).toBe(200);
      expect(res.body.document_id).toBe(mockDocId);
      expect(res.body.status).toBe('analyzed');
    });

    it('should return 404 for missing document', async () => {
      vi.mocked(documentReadRepository.getDocumentBase).mockResolvedValue(null);

      const res = await request(app).get(`/api/documents/${mockDocId}`);
      expect(res.status).toBe(404);
    });

    it('should return 400 for malformed document ID', async () => {
      const res = await request(app).get('/api/documents/invalid');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/documents/:documentId/overview', () => {
    it('should return valid overview', async () => {
      vi.mocked(documentReadRepository.getDocumentOverview).mockResolvedValue({
        id: mockDocId,
        filename: 'test.pdf',
        document_type: 'contract',
        jurisdiction: 'US',
        status: 'analyzed',
        executive_summary: 'Test summary',
        key_findings: '["Finding 1"]',
        total_clauses: 10,
        standard_count: 8,
        caution_count: 1,
        unfavorable_count: 1,
        overall_risk_score: '2.5'
      });

      const res = await request(app).get(`/api/documents/${mockDocId}/overview`);
      expect(res.status).toBe(200);
      expect(res.body.metadata.document_id).toBe(mockDocId);
      expect(res.body.executive_summary).toBe('Test summary');
      expect(res.body.state.standard_count).toBe(8);
      expect(res.body.disclaimer).toBeDefined();
    });
  });

  describe('GET /api/documents/:documentId/clauses', () => {
    it('should return valid clauses with pagination', async () => {
      vi.mocked(documentReadRepository.getDocumentBase).mockResolvedValue({ id: mockDocId });
      vi.mocked(documentReadRepository.getDocumentClauses).mockResolvedValue({
        clauses: [
          {
            id: mockClauseId,
            clause_index: 0,
            section_number: '1',
            title: 'Test',
            raw_text: 'Test',
            risk_level: 'Standard',
            confidence_score: '0.99',
            category: 'General',
            is_novel_clause: false,
            deviation_summary: null,
            risk_factors: '[]'
          }
        ],
        total: 1
      });

      const res = await request(app).get(`/api/documents/${mockDocId}/clauses?page=1&pageSize=10`);
      expect(res.status).toBe(200);
      expect(res.body.clauses).toHaveLength(1);
      expect(res.body.pagination.total).toBe(1);
      expect(res.body.pagination.page_size).toBe(10);
      expect(res.body.clauses[0].risk_assessment.risk_level).toBe('Standard');
    });
  });

  describe('GET /api/documents/:documentId/clauses/:clauseId', () => {
    it('should return valid clause detail', async () => {
      vi.mocked(documentReadRepository.getClauseDetail).mockResolvedValue({
        id: mockClauseId,
        clause_index: 0,
        section_number: '1',
        title: 'Test',
        raw_text: 'Test',
        risk_level: 'Caution',
        confidence_score: '0.8',
        category: 'General',
        is_novel_clause: false,
        deviation_summary: 'Test',
        risk_factors: '["Factor 1"]',
        matched_benchmark_id: 'bench-1',
        benchmark_title: 'Bench',
        benchmark_text: 'Bench text',
        benchmark_explanation: 'Bench exp',
        benchmark_risk_baseline: 'Standard'
      });

      const res = await request(app).get(`/api/documents/${mockDocId}/clauses/${mockClauseId}`);
      expect(res.status).toBe(200);
      expect(res.body.clause_id).toBe(mockClauseId);
      expect(res.body.benchmark.id).toBe('bench-1');
      expect(res.body.risk_assessment.delta.risk_factors).toContain('Factor 1');
    });

    it('should return 404 for clause belonging to another doc', async () => {
      vi.mocked(documentReadRepository.getClauseDetail).mockResolvedValue(null);
      const res = await request(app).get(`/api/documents/${mockDocId}/clauses/${mockClauseId}`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/documents/:documentId/gotchas', () => {
    it('should return gotchas', async () => {
      vi.mocked(documentReadRepository.getDocumentBase).mockResolvedValue({ id: mockDocId });
      vi.mocked(documentReadRepository.getGotchas).mockResolvedValue([
        { id: '1', priority: 1, title: 'Gotcha', severity: 'Critical', impact_description: 'Test', plain_english_advice: 'Test', related_clause_ids: '[]' }
      ]);

      const res = await request(app).get(`/api/documents/${mockDocId}/gotchas`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('Gotcha');
    });
  });

  describe('GET /api/documents/:documentId/checklist', () => {
    it('should return checklist', async () => {
      vi.mocked(documentReadRepository.getDocumentBase).mockResolvedValue({ id: mockDocId });
      vi.mocked(documentReadRepository.getChecklist).mockResolvedValue([
        { id: '1', priority: 1, item: 'Item', category: 'General', status: 'Action Required', impact_rationale: 'Test' }
      ]);

      const res = await request(app).get(`/api/documents/${mockDocId}/checklist`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe('GET /api/documents/:documentId/brief', () => {
    it('should return consolidated audit packet', async () => {
      vi.mocked(documentReadRepository.getDocumentBase).mockResolvedValue({ id: mockDocId });
      vi.mocked(documentReadRepository.getDocumentOverview).mockResolvedValue({ id: mockDocId, executive_summary: 'Test', key_findings: '[]' });
      vi.mocked(documentReadRepository.getGotchas).mockResolvedValue([]);
      vi.mocked(documentReadRepository.getChecklist).mockResolvedValue([]);
      vi.mocked(documentReadRepository.getAttorneyBriefs).mockResolvedValue([
        { id: '1', priority: 1, clause_ref: '1', question: 'Question?', context_summary: 'Context' }
      ]);

      const res = await request(app).get(`/api/documents/${mockDocId}/brief`);
      expect(res.status).toBe(200);
      expect(res.body.executive_summary).toBe('Test');
      expect(res.body.attorney_consultation_questions).toHaveLength(1);
    });
  });
});
