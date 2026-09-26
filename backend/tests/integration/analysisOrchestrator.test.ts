import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalysisJobOrchestrator } from '../../src/services/analysis/analysisOrchestrator.js';
import { documentRepository } from '../../src/repositories/documentRepository.js';
import { analysisRepository } from '../../src/repositories/analysisRepository.js';
import { IngestionService } from '../../src/services/ingestion/ingestionService.js';
import { RetrievalService } from '../../src/services/retrieval/retrievalService.js';
import { RiskReasoningService } from '../../src/services/risk/riskService.js';
import { LegalIntelligenceService } from '../../src/services/legal/legalService.js';
import { BenchmarkService } from '../../src/services/benchmark/benchmarkService.js';
import fs from 'fs';

vi.mock('../../src/repositories/documentRepository.js');
vi.mock('../../src/repositories/analysisRepository.js');
vi.mock('../../src/services/ingestion/ingestionService.js');
vi.mock('../../src/services/benchmark/benchmarkService.js');
vi.mock('fs');

describe('Analysis Job Orchestrator', () => {
  let orchestrator: AnalysisJobOrchestrator;

  beforeEach(() => {
    vi.resetAllMocks();
    
    // Mock fs dependencies
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);

    // Mock document repo
    vi.mocked(documentRepository.getDocumentById).mockResolvedValue({
      id: 'doc-123',
      filename: 'test.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 100,
      status: 'uploaded',
      created_at: new Date()
    });

    vi.mocked(documentRepository.updateDocumentStatus).mockResolvedValue();

    // Mock ingestion
    vi.mocked(IngestionService.ingest).mockResolvedValue({
      documentArtifact: {
        id: 'doc-123',
        metadata: { filename: 'test.pdf', file_size_bytes: 100, mime_type: 'application/pdf', jurisdiction: 'US', document_type: 'contract', is_scanned: false },
        state: { status: 'processing', progress_percentage: 10 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      clauseArtifacts: [
        {
          id: 'clause-123',
          document_id: 'doc-123',
          location: { clause_index: 0 },
          content: { raw_text: 'test', tokenized_text: 'test', sha256: 'hash' },
          is_novel_clause: false,
          created_at: new Date().toISOString()
        }
      ]
    });

    // Mock Retrieval Service
    vi.spyOn(RetrievalService.prototype, 'retrieveBenchmarks').mockResolvedValue({
      clause_id: 'clause-123',
      classified_category: 'Indemnification',
      matches: [{ benchmark_id: 'bench-123', cosine_similarity: 0.9, rank: 1 }],
      is_benchmark_gap: false
    });

    vi.mocked(BenchmarkService.getBenchmarkById).mockResolvedValue({
      id: 'bench-123',
      category: 'Indemnification',
      contract_family: 'general',
      jurisdiction: 'US',
      title: 'Standard',
      standard_text: 'test',
      plain_explanation: 'test',
      risk_baseline: 'Standard'
    });

    // Mock Risk Reasoning
    vi.spyOn(RiskReasoningService.prototype, 'evaluateClause').mockResolvedValue({
      clause_id: 'clause-123',
      risk_level: 'Caution',
      confidence_score: 0.9,
      primary_category: 'Indemnification',
      is_novel_clause: false
    });

    // Mock Legal Intelligence
    vi.spyOn(LegalIntelligenceService.prototype, 'generateGotchas').mockResolvedValue([]);
    vi.spyOn(LegalIntelligenceService.prototype, 'generateChecklist').mockResolvedValue([]);
    vi.spyOn(LegalIntelligenceService.prototype, 'generateAttorneyBrief').mockResolvedValue([]);
    vi.spyOn(LegalIntelligenceService.prototype, 'generateExecutiveSummary').mockResolvedValue({
      executive_summary: 'Summary',
      key_findings: []
    });

    orchestrator = new AnalysisJobOrchestrator();
  });

  it('should orchestrate document analysis successfully', async () => {
    await orchestrator.execute({
      job_id: 'job:doc:123',
      document_id: 'doc-123',
      jurisdiction: 'General Commercial',
      document_type: 'general_contract',
      priority: 0
    });

    expect(documentRepository.updateDocumentStatus).toHaveBeenCalledWith('doc-123', 'processing');
    expect(analysisRepository.upsertClauses).toHaveBeenCalled();
    expect(analysisRepository.upsertConsolidatedAudit).toHaveBeenCalled();
    expect(analysisRepository.completeDocumentProcessing).toHaveBeenCalledWith('doc-123', { standard: 0, caution: 1, unfavorable: 0 });
    expect(fs.promises.unlink).toHaveBeenCalled();
  });

  it('should handle document not found', async () => {
    vi.mocked(documentRepository.getDocumentById).mockResolvedValue(null);

    await expect(orchestrator.execute({
      job_id: 'job:doc:999',
      document_id: 'doc-999',
      jurisdiction: 'General Commercial',
      document_type: 'general_contract',
      priority: 0
    })).rejects.toThrow('Document doc-999 not found');
  });

  it('should handle missing temp file', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await expect(orchestrator.execute({
      job_id: 'job:doc:123',
      document_id: 'doc-123',
      jurisdiction: 'General Commercial',
      document_type: 'general_contract',
      priority: 0
    })).rejects.toThrow('not found on disk');
  });

  it('should halt on ingestion failure', async () => {
    vi.mocked(IngestionService.ingest).mockResolvedValue({
      documentArtifact: {
        id: 'doc-123',
        metadata: { filename: 'test.pdf', file_size_bytes: 100, mime_type: 'application/pdf', jurisdiction: 'US', document_type: 'contract', is_scanned: true },
        state: { status: 'failed', progress_percentage: 0, error_message: 'DOCUMENT_REQUIRES_OCR' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      clauseArtifacts: []
    });

    await expect(orchestrator.execute({
      job_id: 'job:doc:123',
      document_id: 'doc-123',
      jurisdiction: 'General Commercial',
      document_type: 'general_contract',
      priority: 0
    })).rejects.toThrow('DOCUMENT_REQUIRES_OCR');
  });
});
