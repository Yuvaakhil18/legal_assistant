import { env } from '../../config/env.js';
import { cacheGet, cacheSet } from '../cache.js';
import { LlmProvider, GeminiLlmProvider } from '../llm/provider.js';
import { RISK_AUDIT_SYSTEM_PROMPT, buildRiskPrompt } from './prompts.js';
import { RiskAssessment, RiskAssessmentSchema } from '../../types/contracts.js';
import crypto from 'crypto';
import { logger } from '../../utils/logger.js';

export interface RiskContext {
  clause_id: string;
  raw_text: string;
  category: string;
  jurisdiction: string;
  is_benchmark_gap: boolean;
  benchmark?: {
    text: string;
    explanation: string;
    risk_baseline: string;
  };
}

export class RiskReasoningService {
  private llmProvider: LlmProvider;
  private readonly PROMPT_VERSION = 'v1.0';

  constructor(llmProvider?: LlmProvider) {
    this.llmProvider = llmProvider || new GeminiLlmProvider();
  }

  private hashData(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  private buildCacheKey(clauseText: string, benchmarkText?: string): string {
    const model = env.MODEL_REASONING || 'gemini-3.8-flash';
    const benchmarkHash = benchmarkText ? this.hashData(benchmarkText) : 'novel';
    const clauseHash = this.hashData(clauseText);
    // cache:eval:v2:<model_id>:<prompt_version>:<benchmark_hash>:<clause_sha256>
    return `cache:eval:v2:${model}:${this.PROMPT_VERSION}:${benchmarkHash}:${clauseHash}`;
  }

  async evaluateClause(context: RiskContext): Promise<RiskAssessment> {
    const cacheKey = this.buildCacheKey(context.raw_text, context.benchmark?.text);

    // 1. Check Cache
    try {
      const cachedStr = await cacheGet(cacheKey);
      if (cachedStr) {
        const parsed = JSON.parse(cachedStr);
        const validated = RiskAssessmentSchema.safeParse(parsed);
        if (validated.success) {
          // Ensure clause_id matches the requested context (cache might be shared across same text)
          return { ...validated.data, clause_id: context.clause_id };
        }
      }
    } catch (err) {
      logger.warn(`Failed to read evaluation cache for key ${cacheKey}`, { err });
    }

    // 2. Build Prompts
    const prompt = buildRiskPrompt(
      context.raw_text,
      context.category,
      context.jurisdiction,
      context.benchmark
    );

    // 3. Define schema for Gemini (simplified OpenAPI subset)
    const responseSchema = {
      type: 'OBJECT',
      properties: {
        clause_id: { type: 'STRING' },
        risk_level: { type: 'STRING', enum: ['Standard', 'Caution', 'Unfavorable'] },
        confidence_score: { type: 'NUMBER' },
        primary_category: { type: 'STRING' },
        delta: {
          type: 'OBJECT',
          properties: {
            deviation_summary: { type: 'STRING' },
            risk_factors: {
              type: 'ARRAY',
              items: { type: 'STRING' }
            },
            evidence: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  quote: { type: 'STRING' },
                  reasoning: { type: 'STRING' }
                }
              }
            }
          }
        },
        is_novel_clause: { type: 'BOOLEAN' }
      },
      required: ['clause_id', 'risk_level', 'confidence_score', 'primary_category', 'is_novel_clause']
    };

    // 4. Generate & Validate
    const maxRetries = 1;
    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        const rawResponse = await this.llmProvider.generateStructured<unknown>({
          systemInstruction: RISK_AUDIT_SYSTEM_PROMPT,
          prompt,
          responseSchema
        });

        // Safe parse using the Canonical Zod schema
        const validation = RiskAssessmentSchema.safeParse(rawResponse);
        
        if (!validation.success) {
          throw new Error(`LLM output violated RiskAssessment schema: ${validation.error.message}`);
        }

        const validAssessment = validation.data;
        // Fix ID mismatch if LLM invents one
        validAssessment.clause_id = context.clause_id;

        // 5. Cache result
        try {
          // TTL 14 days = 14 * 24 * 60 * 60 = 1209600
          await cacheSet(cacheKey, JSON.stringify(validAssessment), 1209600);
        } catch (err) {
          logger.warn(`Failed to set evaluation cache for key ${cacheKey}`, { err });
        }

        return validAssessment;

      } catch (err: unknown) {
        attempt++;
        const msg = err instanceof Error ? err.message : 'Unknown';
        logger.error(`Risk Reasoner Attempt ${attempt} Failed: ${msg}`);
        
        if (attempt > maxRetries) {
          throw new Error(`Risk Reasoning failed definitively: ${msg}`);
        }
      }
    }

    throw new Error('Unreachable');
  }
}
