import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryService } from '../../../src/services/query/queryService.js';
import { EmbeddingService } from '../../../src/services/embedding/embeddingService.js';
import { LlmProvider, LlmRequest } from '../../../src/services/llm/provider.js';

class MockLlmProvider implements LlmProvider {
  public nextResponse: any = {};
  async generateStructured<T>(_req: LlmRequest): Promise<T> {
    return this.nextResponse as T;
  }
}

describe('Query Service', () => {
  let service: QueryService;
  let llm: MockLlmProvider;
  let embeddingService: any;

  beforeEach(() => {
    llm = new MockLlmProvider();
    embeddingService = {
      getEmbedding: vi.fn().mockResolvedValue(new Array(768).fill(0))
    };
    service = new QueryService(llm, embeddingService as unknown as EmbeddingService);
  });

  it('should return information not found if no clauses are provided', async () => {
    const queryObj = { document_id: '123e4567-e89b-12d3-a456-426614174000', question: 'What?' };
    
    const result = await service.answerQuestion(queryObj, []);

    expect(result.answer).toContain('Information not found');
    expect(result.grounding_citations).toHaveLength(0);
  });

  it('should apply guardrails and validate schema for Q&A', async () => {
    const clauseId = '123e4567-e89b-12d3-a456-426614174000';
    llm.nextResponse = {
      answer: 'The contract says yes.',
      grounding_citations: [{ clause_id: clauseId, relevance_score: 0.9 }],
      suggested_follow_ups: ['Why?']
    };

    const queryObj = { document_id: clauseId, question: 'Can I?' };
    
    // Using vi.spyOn to mock RetrievalService instead of passing clauses manually
    const retrieveMock = vi.fn().mockResolvedValue([{
        clause_id: clauseId, section_number: '1', title: 'Test', text: 'Yes.' 
    }]);
    (service as any).retrievalService.retrieveDocumentClauses = retrieveMock;

    const result = await service.answerQuestion(queryObj);

    expect(result.grounding_citations).toHaveLength(1);
    expect(result.grounding_citations[0].clause_id).toBe(clauseId);
  });

  it('should evict hallucinated citations from the result', async () => {
    const queryObj = { document_id: '123e4567-e89b-12d3-a456-426614174000', question: 'Test?' };
    
    // Model returns a fake ID
    llm.nextResponse = {
      answer: 'Yes.',
      grounding_citations: [{ clause_id: 'fake-hallucinated-id', relevance_score: 0.9 }],
      suggested_follow_ups: []
    };

    // Actual retrieved evidence only has 'real-id'
    const retrieveMock = vi.fn().mockResolvedValue([{
        clause_id: 'real-id', section_number: '1', title: 'Test', text: 'Yes.' 
    }]);
    (service as any).retrievalService.retrieveDocumentClauses = retrieveMock;

    const result = await service.answerQuestion(queryObj);

    // The citation should be filtered out
    expect(result.grounding_citations).toHaveLength(0);
  });

  it('should explicitly inject an application-controlled disclaimer', async () => {
    const queryObj = { document_id: '123e4567-e89b-12d3-a456-426614174000', question: 'Test?' };
    
    // Model returns an answer without a disclaimer
    llm.nextResponse = {
      answer: 'This is a factual answer.',
      grounding_citations: [],
      suggested_follow_ups: []
    };

    const retrieveMock = vi.fn().mockResolvedValue([{
        clause_id: '123e4567-e89b-12d3-a456-426614174000', section_number: '1', title: 'Test', text: 'Fact.' 
    }]);
    (service as any).retrievalService.retrieveDocumentClauses = retrieveMock;

    const result = await service.answerQuestion(queryObj);

    // Assert the application forcibly injects the text
    expect(result.answer).toContain('DISCLAIMER: This information is provided for educational and informational purposes only');
  });
});
