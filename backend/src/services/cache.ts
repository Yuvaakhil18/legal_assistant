import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let redisClient: Redis | null = null;
let isInMemoryCacheActive = false;

// Simple in-memory fallback cache with TTL support
interface CacheEntry {
  value: string;
  expiresAt: number;
}
const memoryCache = new Map<string, CacheEntry>();

export function getRedisClient(): Redis | null {
  if (isInMemoryCacheActive) return null;

  if (!redisClient) {
    try {
      redisClient = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        retryStrategy(times: number) {
          if (times > 2) {
            if (env.USE_IN_MEMORY_FALLBACK) {
              isInMemoryCacheActive = true;
            }
            return null; // Stop retrying
          }
          return 500;
        },
        lazyConnect: true
      });

      redisClient.on('error', (err: Error) => {
        logger.warn('Redis client connection error', { failureReason: err.message });
        if (env.USE_IN_MEMORY_FALLBACK) {
          isInMemoryCacheActive = true;
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn('Failed to initialize Redis client', { failureReason: msg });
      if (env.USE_IN_MEMORY_FALLBACK) {
        isInMemoryCacheActive = true;
      }
    }
  }
  return redisClient;
}

export async function checkRedisHealth(): Promise<{ connected: boolean; provider: string; isFallback: boolean; error?: string }> {
  if (isInMemoryCacheActive) {
    return { connected: true, provider: 'in-memory-lru', isFallback: true };
  }

  const client = getRedisClient();
  if (!client) {
    if (env.USE_IN_MEMORY_FALLBACK) {
      isInMemoryCacheActive = true;
      return { connected: true, provider: 'in-memory-lru', isFallback: true };
    }
    return { connected: false, provider: 'redis', isFallback: false, error: 'Redis client not initialized' };
  }

  try {
    if (client.status === 'wait') {
      await client.connect();
    }
    const pong = await client.ping();
    return { connected: pong === 'PONG', provider: 'redis', isFallback: false };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (env.USE_IN_MEMORY_FALLBACK) {
      logger.info('Redis unreachable, activating in-memory fallback cache', { failureReason: msg });
      isInMemoryCacheActive = true;
      return { connected: true, provider: 'in-memory-lru', isFallback: true };
    }
    return { connected: false, provider: 'redis', isFallback: false, error: msg };
  }
}

export async function cacheGet(key: string): Promise<string | null> {
  if (isInMemoryCacheActive) {
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      memoryCache.delete(key);
      return null;
    }
    return entry.value;
  }

  const client = getRedisClient();
  if (!client) return null;

  try {
    return await client.get(key);
  } catch (_err: unknown) {
    if (env.USE_IN_MEMORY_FALLBACK) {
      isInMemoryCacheActive = true;
      return cacheGet(key);
    }
    return null;
  }
}

export async function cacheSet(key: string, value: string, ttlSeconds: number = 86400): Promise<void> {
  if (isInMemoryCacheActive) {
    memoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000
    });
    // Evict oldest if exceeding 5000 entries
    if (memoryCache.size > 5000) {
      const firstKey = memoryCache.keys().next().value;
      if (firstKey) memoryCache.delete(firstKey);
    }
    return;
  }

  const client = getRedisClient();
  if (!client) return;

  try {
    await client.setex(key, ttlSeconds, value);
  } catch (_err: unknown) {
    if (env.USE_IN_MEMORY_FALLBACK) {
      isInMemoryCacheActive = true;
      cacheSet(key, value, ttlSeconds);
    }
  }
}
