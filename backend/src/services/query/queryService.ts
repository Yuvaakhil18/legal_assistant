import { LlmProvider, GeminiLlmProvider } from '../llm/provider.js';
import { DocumentQuery, QueryResponse, QueryResponseSchema } from '../../types/query.js';
import { QUERY_SYSTEM_PROMPT, buildQueryPrompt } from './prompts.js';
import { GuardrailService } from '../guardrails/guardrailService.js';
import { EmbeddingService } from '../embedding/embeddingService.js';
import { RetrievalService } from '../retrieval/retrievalService.js';
import { logger } from '../../utils/logger.js';

export class QueryService {
  private llmProvider: LlmProvider;
  private embeddingService: EmbeddingService;
  private retrievalService: RetrievalService;

  constructor(llmProvider?: LlmProvider, embeddingService?: EmbeddingService, retrievalService?: RetrievalService) {
    this.llmProvider = llmProvider || new GeminiLlmProvider();
    this.embeddingService = embeddingService || new EmbeddingService();
    this.retrievalService = retrievalService || new RetrievalService(this.embeddingService);
  }

  async answerQuestion(documentQuery: DocumentQuery): Promise<QueryResponse> {
    
    // 1. Retrieve relevant clauses based on canonical retrieval
    const questionEmbedding = await this.embeddingService.getEmbedding(documentQuery.question);
    
    const evidenceClauses = await this.retrievalService.retrieveDocumentClauses(
      documentQuery.document_id,
      questionEmbedding,
      4
    );

    if (evidenceClauses.length === 0) {
      return {
        document_id: documentQuery.document_id,
        question: documentQuery.question,
        answer: "Information not found in document.",
        grounding_citations: [],
        suggested_follow_ups: []
      };
    }

    // 2. Build Prompt
    const prompt = buildQueryPrompt(documentQuery.question, evidenceClauses);
    const schema = {
      type: 'OBJECT',
      properties: {
        answer: { type: 'STRING' },
        grounding_citations: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              clause_id: { type: 'STRING' },
              section_number: { type: 'STRING' },
              title: { type: 'STRING' },
              relevance_score: { type: 'NUMBER' }
            },
            required: ['clause_id', 'relevance_score']
          }
        },
        suggested_follow_ups: {
          type: 'ARRAY',
          items: { type: 'STRING' }
        }
      },
      required: ['answer', 'grounding_citations', 'suggested_follow_ups']
    };

    // 3. Generate Answer
    const rawResult = await this.llmProvider.generateStructured<unknown>({
      systemInstruction: QUERY_SYSTEM_PROMPT,
      prompt,
      responseSchema: schema,
      temperature: 0.1
    });

    const parsedData = rawResult as {
      answer: string;
      grounding_citations: Record<string, unknown>[];
      suggested_follow_ups: string[];
    };

    // 4. Guardrails Validation
    const guardrailResult = GuardrailService.applyGuardrails(parsedData.answer, 'Q&A');
    if (!guardrailResult.is_compliant) {
      throw new Error(`Guardrail violation: Q&A output was rejected due to: ${guardrailResult.flagged_reasons?.join(', ')}`);
    }

    // Application-Controlled Disclaimer injection
    const qnaDisclaimer = "\n\n[DISCLAIMER: This information is provided for educational and informational purposes only. It is not legal advice, nor does it create an attorney-client relationship. You should consult a qualified attorney for advice regarding your specific situation.]";
    if (!parsedData.answer.includes('DISCLAIMER:')) {
      parsedData.answer += qnaDisclaimer;
    }

    // 5. Evidence/Citation Integrity Validation
    const validEvidenceIds = new Set(evidenceClauses.map(e => e.clause_id));
    const validatedCitations = parsedData.grounding_citations
      .filter(cit => typeof cit.clause_id === 'string' && validEvidenceIds.has(cit.clause_id));

    // 6. Verification
    const responseObj = {
      document_id: documentQuery.document_id,
      question: documentQuery.question,
      answer: parsedData.answer,
      grounding_citations: validatedCitations,
      suggested_follow_ups: parsedData.suggested_follow_ups || [],
      metrics: {
        prompt_tokens: 0,
        completion_tokens: 0
      }
    };

    const validation = QueryResponseSchema.safeParse(responseObj);
    if (!validation.success) {
      logger.error('Query schema validation failed', { error: validation.error });
      throw new Error(`Malformed Query Response: ${validation.error.message}`);
    }

    return validation.data;
  }
}
