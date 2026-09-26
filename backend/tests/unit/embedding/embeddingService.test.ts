import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmbeddingService } from '../../../src/services/embedding/embeddingService.js';
import { MockEmbeddingProvider } from '../../../src/services/embedding/provider.js';
import * as cacheModule from '../../../src/services/cache.js';
import { env } from '../../../src/config/env.js';

vi.mock('../../../src/services/cache.js', () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
  checkRedisHealth: vi.fn().mockResolvedValue({ connected: true })
}));

describe('Embedding Service', () => {
  let embeddingService: EmbeddingService;

  beforeEach(() => {
    vi.clearAllMocks();
    embeddingService = new EmbeddingService(new MockEmbeddingProvider());
  });

  it('should generate fresh embeddings and save to cache', async () => {
    (cacheModule.cacheGet as any).mockResolvedValue(null);
    
    const results = await embeddingService.getEmbeddings(['new text']);
    
    expect(results).toHaveLength(1);
    expect(results[0]).toHaveLength(env.EMBEDDING_DIMENSIONS);
    expect(cacheModule.cacheGet).toHaveBeenCalledTimes(1);
    expect(cacheModule.cacheSet).toHaveBeenCalledTimes(1);
  });

  it('should return cached embeddings without calling provider', async () => {
    const fakeVec = new Array(env.EMBEDDING_DIMENSIONS).fill(0.1);
    (cacheModule.cacheGet as any).mockResolvedValue(JSON.stringify(fakeVec));
    
    // Using a spy to verify the mock provider isn't called
    const providerSpy = vi.spyOn(embeddingService['provider'], 'embedBatch');

    const results = await embeddingService.getEmbeddings(['cached text']);
    
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(fakeVec);
    expect(cacheModule.cacheGet).toHaveBeenCalledTimes(1);
    expect(providerSpy).not.toHaveBeenCalled();
    expect(cacheModule.cacheSet).not.toHaveBeenCalled();
  });
});
