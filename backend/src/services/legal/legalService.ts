import { LlmProvider, GeminiLlmProvider } from '../llm/provider.js';
import { RiskAssessment } from '../../types/contracts.js';
import { 
  Gotcha, ChecklistItem, AttorneyConsultationQuestion, CounterDraft,
  GotchaSchema, ChecklistItemSchema, AttorneyConsultationQuestionSchema, CounterDraftSchema 
} from '../../types/legal.js';
import { 
  LEGAL_INTELLIGENCE_SYSTEM_PROMPT, 
  buildGotchasPrompt, buildChecklistPrompt, buildAttorneyBriefPrompt, buildCounterDraftPrompt 
} from './prompts.js';
import { GuardrailService } from '../guardrails/guardrailService.js';
import { logger } from '../../utils/logger.js';
import { z } from 'zod';

export class LegalIntelligenceService {
  private llmProvider: LlmProvider;

  constructor(llmProvider?: LlmProvider) {
    this.llmProvider = llmProvider || new GeminiLlmProvider();
  }

  async generateGotchas(assessments: RiskAssessment[]): Promise<Gotcha[]> {
    const highRisks = assessments.filter(a => a.risk_level !== 'Standard');
    if (highRisks.length === 0) return [];

    const prompt = buildGotchasPrompt(highRisks);
    const schema = {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          priority: { type: 'NUMBER' },
          title: { type: 'STRING' },
          severity: { type: 'STRING', enum: ['Critical', 'High', 'Moderate'] },
          impact_description: { type: 'STRING' },
          plain_english_advice: { type: 'STRING' },
          related_clause_ids: { type: 'ARRAY', items: { type: 'STRING' } }
        },
        required: ['priority', 'title', 'severity', 'impact_description', 'plain_english_advice', 'related_clause_ids']
      }
    };

    const result = await this.llmProvider.generateStructured<unknown>({
      systemInstruction: LEGAL_INTELLIGENCE_SYSTEM_PROMPT,
      prompt,
      responseSchema: schema,
      temperature: 0.2
    });

    const parsed = z.array(GotchaSchema).safeParse(result);
    if (!parsed.success) {
      logger.error('Gotcha schema validation failed', { error: parsed.error });
      throw new Error('Malformed Gotcha generation');
    }

    return parsed.data;
  }

  async generateChecklist(documentContext: string, assessments: RiskAssessment[]): Promise<ChecklistItem[]> {
    const prompt = buildChecklistPrompt(documentContext, assessments);
    const schema = {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          priority: { type: 'NUMBER' },
          item: { type: 'STRING' },
          category: { type: 'STRING' },
          status: { type: 'STRING', enum: ['Action Required', 'Verified', 'Optional'] },
          impact_rationale: { type: 'STRING' }
        },
        required: ['priority', 'item', 'category', 'status', 'impact_rationale']
      }
    };

    const result = await this.llmProvider.generateStructured<unknown>({
      systemInstruction: LEGAL_INTELLIGENCE_SYSTEM_PROMPT,
      prompt,
      responseSchema: schema,
      temperature: 0.2
    });

    const parsed = z.array(ChecklistItemSchema).safeParse(result);
    if (!parsed.success) {
      throw new Error('Malformed Checklist generation');
    }

    return parsed.data;
  }

  async generateAttorneyBrief(documentContext: string, assessments: RiskAssessment[]): Promise<AttorneyConsultationQuestion[]> {
    const highRisks = assessments.filter(a => a.risk_level === 'Unfavorable');
    const prompt = buildAttorneyBriefPrompt(documentContext, highRisks);
    const schema = {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          priority: { type: 'NUMBER' },
          clause_ref: { type: 'STRING' },
          question: { type: 'STRING' },
          context_summary: { type: 'STRING' }
        },
        required: ['priority', 'clause_ref', 'question', 'context_summary']
      }
    };

    const result = await this.llmProvider.generateStructured<unknown>({
      systemInstruction: LEGAL_INTELLIGENCE_SYSTEM_PROMPT,
      prompt,
      responseSchema: schema,
      temperature: 0.2
    });

    const parsed = z.array(AttorneyConsultationQuestionSchema).safeParse(result);
    if (!parsed.success) {
      throw new Error('Malformed Attorney Brief generation');
    }

    return parsed.data;
  }

  async generateExecutiveSummary(assessments: RiskAssessment[]): Promise<{ executive_summary: string, key_findings: string[] }> {
    const highRisks = assessments.filter(a => a.risk_level !== 'Standard');
    const prompt = `Based on the following risk assessments, provide a brief executive summary and 3-5 key findings.\n\n${JSON.stringify(highRisks)}`;
    
    const schema = {
      type: 'OBJECT',
      properties: {
        executive_summary: { type: 'STRING' },
        key_findings: { type: 'ARRAY', items: { type: 'STRING' } }
      },
      required: ['executive_summary', 'key_findings']
    };

    const result = await this.llmProvider.generateStructured<{ executive_summary: string, key_findings: string[] }>({
      systemInstruction: LEGAL_INTELLIGENCE_SYSTEM_PROMPT,
      prompt,
      responseSchema: schema,
      temperature: 0.2
    });
    
    return result;
  }

  async generateCounterDraft(clauseId: string, clauseText: string, category: string, riskFactors: string[]): Promise<CounterDraft> {
    const prompt = buildCounterDraftPrompt(clauseText, category, riskFactors);
    const schema = {
      type: 'OBJECT',
      properties: {
        proposed_text: { type: 'STRING' },
        key_modifications: { type: 'ARRAY', items: { type: 'STRING' } },
        negotiation_talking_point: { type: 'STRING' }
      },
      required: ['proposed_text', 'key_modifications', 'negotiation_talking_point']
    };

    const result = await this.llmProvider.generateStructured<unknown>({
      systemInstruction: LEGAL_INTELLIGENCE_SYSTEM_PROMPT,
      prompt,
      responseSchema: schema,
      temperature: 0.3
    });

    const parsedData = result as {
      proposed_text: string;
      key_modifications: string[];
      negotiation_talking_point: string;
    };
    
    if (!GuardrailService.validateCounterDraftLabel(parsedData.proposed_text)) {
      parsedData.proposed_text = "Sample / educational language - not legal advice.\n\n" + parsedData.proposed_text;
    }

    const guardrailResult = GuardrailService.applyGuardrails(parsedData.proposed_text, 'CounterDraft');
    if (!guardrailResult.is_compliant) {
      throw new Error(`Guardrail violation: CounterDraft output was rejected due to: ${guardrailResult.flagged_reasons?.join(', ')}`);
    }
    
    const draft = {
      clause_id: clauseId,
      proposed_text: parsedData.proposed_text,
      key_modifications: parsedData.key_modifications,
      negotiation_talking_point: parsedData.negotiation_talking_point,
      status: 'generated' as const
    };

    const parsed = CounterDraftSchema.safeParse(draft);
    if (!parsed.success) {
      throw new Error(`Malformed Counter Draft generation: ${parsed.error.message}`);
    }

    return parsed.data;
  }
}
