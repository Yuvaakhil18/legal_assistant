import { describe, it, expect } from 'vitest';
import { GuardrailService } from '../../../src/services/guardrails/guardrailService.js';

describe('Guardrail Service', () => {
  it('should flag and reject prescriptive commands', () => {
    const input = 'I advise you to reject this. You must not sign the contract.';
    const result = GuardrailService.applyGuardrails(input, 'Report');
    
    expect(result.is_compliant).toBe(false);
    expect(result.sanitized_content).toBeUndefined();
    expect(result.flagged_reasons).toBeDefined();
  });

  it('should flag and reject representation claims', () => {
    const input = 'As your lawyer, I believe this is unfair to my client.';
    const result = GuardrailService.applyGuardrails(input, 'Q&A');
    
    expect(result.is_compliant).toBe(false);
    expect(result.sanitized_content).toBeUndefined();
  });

  it('should allow ordinary descriptive legal language', () => {
    const input = 'This clause introduces high financial exposure and lacks mutual protections.';
    const result = GuardrailService.applyGuardrails(input, 'Q&A');
    
    expect(result.is_compliant).toBe(true);
    expect(result.sanitized_content).toBe(input);
  });

  it('should validate counter draft labels', () => {
    expect(GuardrailService.validateCounterDraftLabel('Educational/sample language - not legal advice. Here is text.')).toBe(true);
    expect(GuardrailService.validateCounterDraftLabel('Here is a new clause.')).toBe(false);
  });
});
