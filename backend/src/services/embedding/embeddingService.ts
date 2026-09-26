import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { cacheGet, cacheSet } from '../cache.js';
import { EmbeddingProvider, GeminiEmbeddingProvider } from './provider.js';
import crypto from 'crypto';

export class EmbeddingService {
  private provider: EmbeddingProvider;
  
  constructor(provider?: EmbeddingProvider) {
    this.provider = provider || new GeminiEmbeddingProvider();
  }

  private hashText(text: string): string {
    return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
  }

  private buildCacheKey(model: string, hash: string): string {
    return `cache:emb:v2:${model}:RETRIEVAL_DOCUMENT:${hash}`;
  }

  async getEmbeddings(texts: string[]): Promise<number[][]> {
    const model = env.MODEL_EMBEDDING;
    const dimensions = env.EMBEDDING_DIMENSIONS;

    const results: number[][] = new Array(texts.length);
    const missingIndices: number[] = [];
    const missingTexts: string[] = [];

    // 1. Check Cache
    for (let i = 0; i < texts.length; i++) {
      const hash = this.hashText(texts[i]);
      const cacheKey = this.buildCacheKey(model, hash);

      let cached = null;
      try {
        const cachedStr = await cacheGet(cacheKey);
        if (cachedStr) {
          cached = JSON.parse(cachedStr) as number[];
        }
      } catch (err) {
        logger.warn(`Cache read failed for key ${cacheKey}`, { err });
      }

      if (cached && cached.length === dimensions) {
        results[i] = cached;
      } else {
        missingIndices.push(i);
        missingTexts.push(texts[i]);
      }
    }

    // 2. Generate Embeddings for Missing Texts
    if (missingTexts.length > 0) {
      let freshEmbeddings: number[][] = [];
      try {
        freshEmbeddings = await this.provider.embedBatch(missingTexts, model, dimensions);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown';
        logger.error(`Embedding batch generation failed: ${msg}`);
        throw new Error(`Embedding Generation Failed: ${msg}`);
      }

      // 3. Populate Results and Update Cache
      for (let i = 0; i < missingIndices.length; i++) {
        const originalIndex = missingIndices[i];
        const vector = freshEmbeddings[i];
        results[originalIndex] = vector;

        const hash = this.hashText(missingTexts[i]);
        const cacheKey = this.buildCacheKey(model, hash);
        try {
          // TTL 30 days = 30 * 24 * 60 * 60 = 2592000 seconds
          await cacheSet(cacheKey, JSON.stringify(vector), 2592000);
        } catch (err) {
          logger.warn(`Cache write failed for key ${cacheKey}`, { err });
        }
      }
    }

    return results;
  }

  async getEmbedding(text: string): Promise<number[]> {
    const results = await this.getEmbeddings([text]);
    return results[0];
  }
}
