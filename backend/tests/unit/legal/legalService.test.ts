import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LegalIntelligenceService } from '../../../src/services/legal/legalService.js';
import { LlmProvider, LlmRequest } from '../../../src/services/llm/provider.js';

class MockLlmProvider implements LlmProvider {
  public nextResponse: any = {};
  async generateStructured<T>(_req: LlmRequest): Promise<T> {
    return this.nextResponse as T;
  }
}

describe('Legal Intelligence Service', () => {
  let service: LegalIntelligenceService;
  let provider: MockLlmProvider;

  beforeEach(() => {
    provider = new MockLlmProvider();
    service = new LegalIntelligenceService(provider);
  });

  it('should generate valid gotchas from risk assessments', async () => {
    provider.nextResponse = [
      {
        priority: 1,
        title: 'High Risk Indemnity',
        severity: 'Critical',
        impact_description: 'Exposure is uncapped.',
        plain_english_advice: 'Request a cap.',
        related_clause_ids: ['123e4567-e89b-12d3-a456-426614174000']
      }
    ];

    const result = await service.generateGotchas([
      {
        clause_id: '123e4567-e89b-12d3-a456-426614174000',
        risk_level: 'Unfavorable',
        confidence_score: 0.9,
        primary_category: 'Indemnification',
        delta: { deviation_summary: 'test', risk_factors: [], evidence: [] },
        is_novel_clause: false
      }
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('Critical');
  });

  it('should enforce labels on counter drafts', async () => {
    provider.nextResponse = {
      proposed_text: 'Mutually indemnify.',
      key_modifications: ['Made mutual'],
      negotiation_talking_point: 'Standard fairness.'
    };

    const draft = await service.generateCounterDraft('123e4567-e89b-12d3-a456-426614174000', 'original', 'Indemnification', ['risk']);

    expect(draft.proposed_text).toContain('Sample / educational language');
    expect(draft.proposed_text).toContain('Mutually indemnify');
  });
});
