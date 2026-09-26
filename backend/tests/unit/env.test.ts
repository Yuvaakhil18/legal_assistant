import { describe, it, expect } from 'vitest';
import { EnvSchema } from '../../src/config/env.js';

describe('Environment Configuration Schema', () => {
  it('should parse valid default environment options', () => {
    const parsed = EnvSchema.parse({});
    expect(parsed.PORT).toBe(3000);
    expect(parsed.NODE_ENV).toBe('development');
    expect(parsed.MODEL_REASONING).toBe('gemini-3.8-flash');
    expect(parsed.EMBEDDING_DIMENSIONS).toBe(768);
    expect(parsed.USE_IN_MEMORY_FALLBACK).toBe(true);
  });

  it('should coerce string numbers correctly', () => {
    const parsed = EnvSchema.parse({
      PORT: '8080',
      EMBEDDING_DIMENSIONS: '768',
      SIMILARITY_THRESHOLD_HIGH_RISK: '0.75'
    });
    expect(parsed.PORT).toBe(8080);
    expect(parsed.EMBEDDING_DIMENSIONS).toBe(768);
    expect(parsed.SIMILARITY_THRESHOLD_HIGH_RISK).toBe(0.75);
  });

  it('should reject invalid NODE_ENV values', () => {
    expect(() => {
      EnvSchema.parse({ NODE_ENV: 'invalid_env' });
    }).toThrow();
  });
});
