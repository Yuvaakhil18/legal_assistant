import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetrievalService } from '../../../src/services/retrieval/retrievalService.js';
import { EmbeddingService } from '../../../src/services/embedding/embeddingService.js';
import { MockEmbeddingProvider } from '../../../src/services/embedding/provider.js';
import { ClauseArtifact } from '../../../src/types/contracts.js';
import * as db from '../../../src/db/connection.js';
import { env } from '../../../src/config/env.js';
import { v4 as uuidv4 } from 'uuid';

vi.mock('../../../src/db/connection.js', () => ({
  dbQuery: vi.fn()
}));

describe('Retrieval Service', () => {
  let retrievalService: RetrievalService;

  beforeEach(() => {
    vi.clearAllMocks();
    const mockEmbeddingService = new EmbeddingService(new MockEmbeddingProvider());
    retrievalService = new RetrievalService(mockEmbeddingService);
  });

  it('should retrieve benchmarks and apply standard threshold', async () => {
    const clauseId = uuidv4();
    const clause: ClauseArtifact = {
      id: clauseId,
      document_id: uuidv4(),
      location: { clause_index: 1 },
      content: { raw_text: 'Generic paragraph here', tokenized_text: 'Generic paragraph here', sha256: 'hash' },
      is_novel_clause: false,
      created_at: new Date().toISOString()
    };

    (db.dbQuery as any).mockResolvedValue({
      rows: [
        { id: uuidv4(), cosine_similarity: '0.85' },
        { id: uuidv4(), cosine_similarity: '0.50' }
      ]
    });

    const result = await retrievalService.retrieveBenchmarks(clause, {
      jurisdiction: 'US-General',
      contractType: 'nda'
    });

    expect(result.clause_id).toBe(clauseId);
    expect(result.classified_category).toBe('General');
    expect(result.matches).toHaveLength(2);
    expect(result.matches[0].cosine_similarity).toBe(0.85);
    
    // For 'General' category, threshold is SIMILARITY_THRESHOLD_DEFAULT
    // 0.85 > SIMILARITY_THRESHOLD_DEFAULT (e.g. 0.65) -> is_benchmark_gap = false
    expect(result.is_benchmark_gap).toBe(false);
  });

  it('should detect benchmark gap for High-Risk clauses under threshold', async () => {
    const clauseId = uuidv4();
    const clause: ClauseArtifact = {
      id: clauseId,
      document_id: uuidv4(),
      location: { clause_index: 1 },
      content: { raw_text: 'Client shall indemnify all parties', tokenized_text: '...', sha256: 'hash' },
      is_novel_clause: false,
      created_at: new Date().toISOString()
    };

    (db.dbQuery as any).mockResolvedValue({
      rows: [
        { id: uuidv4(), cosine_similarity: '0.68' }
      ]
    });

    // We stub env for testing
    const originalHighRisk = env.SIMILARITY_THRESHOLD_HIGH_RISK;
    (env as any).SIMILARITY_THRESHOLD_HIGH_RISK = 0.72;

    const result = await retrievalService.retrieveBenchmarks(clause, {
      jurisdiction: 'US-General',
      contractType: 'nda'
    });

    expect(result.classified_category).toBe('Indemnification');
    // 0.68 < 0.72, so it's a gap!
    expect(result.is_benchmark_gap).toBe(true);

    (env as any).SIMILARITY_THRESHOLD_HIGH_RISK = originalHighRisk;
  });

  it('should handle empty DB results as benchmark gap', async () => {
    const clauseId = uuidv4();
    const clause: ClauseArtifact = {
      id: clauseId,
      document_id: uuidv4(),
      location: { clause_index: 1 },
      content: { raw_text: 'Unknown stuff', tokenized_text: 'Unknown stuff', sha256: 'hash' },
      is_novel_clause: false,
      created_at: new Date().toISOString()
    };

    (db.dbQuery as any).mockResolvedValue({ rows: [] });

    const result = await retrievalService.retrieveBenchmarks(clause, {
      jurisdiction: 'US-General',
      contractType: 'nda'
    });

    expect(result.matches).toHaveLength(0);
    expect(result.is_benchmark_gap).toBe(true);
  });
});
