import { describe, it, expect, vi } from 'vitest';
import { logger } from '../../src/utils/logger.js';

describe('Structured Logger', () => {
  it('should redact sensitive legal document fields and PII', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logger.info('Test redaction', {
      requestId: 'req-123',
      raw_text: 'Confidential client contract terms',
      tokenized_text: '{{PARTY_A}} agrees to indemnify {{PARTY_B}}',
      password: 'supersecretpassword',
      normalField: 'safeValue'
    });

    expect(consoleSpy).toHaveBeenCalled();
    const loggedOutput = consoleSpy.mock.calls[0][0];
    const parsed = JSON.parse(loggedOutput);

    expect(parsed.requestId).toBe('req-123');
    expect(parsed.normalField).toBe('safeValue');
    expect(parsed.raw_text).toBe('[REDACTED_SENSITIVE_DATA]');
    expect(parsed.tokenized_text).toBe('[REDACTED_SENSITIVE_DATA]');
    expect(parsed.password).toBe('[REDACTED_SENSITIVE_DATA]');

    consoleSpy.mockRestore();
  });
});
