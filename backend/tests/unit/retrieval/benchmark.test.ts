import { describe, it, expect, vi } from 'vitest';
import { BenchmarkService } from '../../../src/services/benchmark/benchmarkService.js';
import * as db from '../../../src/db/connection.js';

vi.mock('../../../src/db/connection.js', () => ({
  dbQuery: vi.fn()
}));

describe('Benchmark Service', () => {
  it('should format insert queries correctly', async () => {
    (db.dbQuery as any).mockResolvedValue({ rowCount: 1 });

    const benchmark = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      category: 'Termination' as const,
      contract_family: 'nda',
      jurisdiction: 'US-General',
      title: 'Mutual Termination',
      standard_text: 'Either party may terminate...',
      plain_explanation: 'Standard mutual termination',
      risk_baseline: 'Standard' as const
    };

    const embedding = [0.1, 0.2, 0.3];
    await BenchmarkService.insertBenchmark(benchmark, embedding);

    expect(db.dbQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO benchmark_clauses'),
      [
        benchmark.id,
        benchmark.category,
        benchmark.contract_family,
        benchmark.jurisdiction,
        benchmark.title,
        benchmark.standard_text,
        benchmark.plain_explanation,
        benchmark.risk_baseline,
        '[0.1,0.2,0.3]'
      ]
    );
  });

  it('should return mapped benchmarks on get', async () => {
    (db.dbQuery as any).mockResolvedValue({
      rows: [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          category: 'Termination',
          contract_family: 'nda',
          jurisdiction: 'US-General',
          title: 'Mutual Termination',
          standard_text: 'Either party may terminate...',
          plain_explanation: 'Standard mutual termination',
          risk_baseline: 'Standard'
        }
      ]
    });

    const results = await BenchmarkService.getBenchmarks('Termination', 'US-General', 'nda');
    
    expect(results).toHaveLength(1);
    expect(results[0].category).toBe('Termination');
  });
});
