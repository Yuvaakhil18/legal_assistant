import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export interface EmbeddingProvider {
  embedBatch(texts: string[], model: string, dimensions: number): Promise<number[][]>;
}

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  async embedBatch(texts: string[], model: string, dimensions: number): Promise<number[][]> {
    if (!env.GEMINI_API_KEY || env.GEMINI_API_KEY.includes('test_mock')) {
      logger.warn('Using MockEmbeddingProvider fallback due to missing/mock GEMINI_API_KEY');
      return new MockEmbeddingProvider().embedBatch(texts, model, dimensions);
    }

    const embeddings: number[][] = [];
    
    // The Gemini batch embedding API supports batch sizes depending on the model.
    // For simplicity, we chunk them and send sequentially or concurrently in smaller batches.
    const CHUNK_SIZE = 5;
    for (let i = 0; i < texts.length; i += CHUNK_SIZE) {
      const chunk = texts.slice(i, i + CHUNK_SIZE);
      
      const requests = chunk.map(text => ({
        model: `models/${model}`,
        content: { parts: [{ text }] },
        outputDimensionality: dimensions
      }));

      try {
        const response = await fetch(`${this.baseUrl}/models/${model}:batchEmbedContents?key=${env.GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests }),
          // Timeout handling via AbortController could be added here
        });

        if (!response.ok) {
          throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as { embeddings: Array<{ values: number[] }> };
        if (!data.embeddings || data.embeddings.length !== chunk.length) {
          throw new Error('Gemini API returned mismatched embedding count');
        }

        embeddings.push(...data.embeddings.map(e => e.values));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown embedding error';
        logger.error(`Embedding chunk failed: ${msg}`);
        throw new Error(`Failed to generate embeddings: ${msg}`);
      }
    }

    return embeddings;
  }
}

export class MockEmbeddingProvider implements EmbeddingProvider {
  async embedBatch(texts: string[], _model: string, dimensions: number): Promise<number[][]> {
    // Generate a deterministic mock vector based on the string length for testing
    return texts.map(text => {
      const vec = new Array(dimensions).fill(0);
      const val = (text.length % 100) / 100;
      vec[0] = val;
      for (let i = 1; i < dimensions; i++) {
        vec[i] = (vec[i - 1] + 0.01) % 1;
      }
      // Normalize vector
      const mag = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
      return vec.map(v => v / mag);
    });
  }
}
