import { describe, it, expect, vi } from 'vitest';
import { GeminiLlmProvider } from '../../../src/services/llm/provider.js';
import { env } from '../../../src/config/env.js';

describe('Gemini LLM Provider', () => {
  it('should use fallback mock when API key is missing or mock', async () => {
    const provider = new GeminiLlmProvider();
    
    // Default env contains 'test_mock_gemini_key'
    const result = await provider.generateStructured<any>({ prompt: 'test' });
    
    expect(result).toBeDefined();
    expect(result.clause_id).toBe('00000000-0000-0000-0000-000000000000');
    expect(result.risk_level).toBe('Caution');
  });

  it('should attempt fetch if real API key is present (mocking global fetch)', async () => {
    const provider = new GeminiLlmProvider();
    const originalKey = env.GEMINI_API_KEY;
    (env as any).GEMINI_API_KEY = 'real-key-123';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"risk_level":"Standard"}' }] } }]
      })
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await provider.generateStructured<any>({ prompt: 'test' });
    
    expect(fetchMock).toHaveBeenCalled();
    expect(result.risk_level).toBe('Standard');

    (env as any).GEMINI_API_KEY = originalKey;
    vi.unstubAllGlobals();
  });
});
