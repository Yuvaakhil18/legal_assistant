import { describe, it, expect } from 'vitest';
import { MockEmbeddingProvider } from '../../../src/services/embedding/provider.js';

describe('Embedding Providers', () => {
  it('MockProvider should return deterministically normalized vectors', async () => {
    const provider = new MockEmbeddingProvider();
    const dimensions = 768;
    
    const results = await provider.embedBatch(['test string', 'another test'], 'mock-model', dimensions);
    
    expect(results).toHaveLength(2);
    expect(results[0]).toHaveLength(dimensions);
    expect(results[1]).toHaveLength(dimensions);
    
    // Test normalization (magnitude should be close to 1)
    const mag = Math.sqrt(results[0].reduce((sum, v) => sum + v * v, 0));
    expect(mag).toBeCloseTo(1, 5);
  });
});
