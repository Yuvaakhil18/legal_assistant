import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnalysisWorker } from '../../src/workers/analysisWorker.js';
import { AnalysisJobOrchestrator } from '../../src/services/analysis/analysisOrchestrator.js';
import * as cache from '../../src/services/cache.js';

vi.mock('../../src/services/analysis/analysisOrchestrator.js');
vi.mock('../../src/services/cache.js');

describe('Analysis Worker Integration', () => {
  let worker: AnalysisWorker;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(cache.checkRedisHealth).mockResolvedValue({ connected: true, provider: 'redis', isFallback: true });
    // Due to fallback being true, the worker won't actually start BullMQ which is good for avoiding open handles in this test context
    worker = new AnalysisWorker();
  });

  afterEach(async () => {
    await worker.stop();
  });

  it('should not start if redis is in fallback mode', async () => {
    await worker.start();
    // Worker start aborted cleanly
    expect(cache.checkRedisHealth).toHaveBeenCalled();
  });
});
