import { dbQuery } from '../../db/connection.js';
import { BenchmarkClause } from '../../types/contracts.js';

export class BenchmarkService {
  /**
   * Retrieves benchmarks matching exactly the category, jurisdiction, and family,
   * preserving provenance.
   */
  static async getBenchmarks(category: string, jurisdiction: string, contractFamily: string): Promise<BenchmarkClause[]> {
    const text = `
      SELECT id, category, contract_family, jurisdiction, title, standard_text, plain_explanation, risk_baseline, is_active
      FROM benchmark_clauses
      WHERE category = $1 
        AND jurisdiction = $2 
        AND contract_family = $3
        AND is_active = true
    `;
    const values = [category, jurisdiction, contractFamily];
    
    try {
      const result = await dbQuery(text, values);
      return (result.rows as Record<string, string>[]).map(row => ({
        id: row.id,
        category: row.category as BenchmarkClause['category'],
        contract_family: row.contract_family,
        jurisdiction: row.jurisdiction,
        title: row.title,
        standard_text: row.standard_text,
        plain_explanation: row.plain_explanation,
        risk_baseline: row.risk_baseline as BenchmarkClause['risk_baseline']
      }));
    } catch (_err: unknown) {
      // Return empty array if DB fallback is active or table not ready,
      // handled seamlessly by retrieval engine.
      return [];
    }
  }

  static async getBenchmarkById(id: string): Promise<BenchmarkClause | null> {
    const text = `
      SELECT id, category, contract_family, jurisdiction, title, standard_text, plain_explanation, risk_baseline, is_active
      FROM benchmark_clauses
      WHERE id = $1
    `;
    try {
      const result = await dbQuery(text, [id]);
      if (result.rows.length === 0) return null;
      const row = result.rows[0] as Record<string, string>;
      return {
        id: row.id,
        category: row.category as BenchmarkClause['category'],
        contract_family: row.contract_family,
        jurisdiction: row.jurisdiction,
        title: row.title,
        standard_text: row.standard_text,
        plain_explanation: row.plain_explanation,
        risk_baseline: row.risk_baseline as BenchmarkClause['risk_baseline']
      };
    } catch (_err) {
      return null;
    }
  }

  static async insertBenchmark(benchmark: BenchmarkClause, embedding: number[]): Promise<void> {
    const text = `
      INSERT INTO benchmark_clauses 
      (id, category, contract_family, jurisdiction, title, standard_text, plain_explanation, risk_baseline, embedding)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO NOTHING
    `;
    // Embedding requires format '[0.1, 0.2, ...]' for pgvector
    const embeddingStr = `[${embedding.join(',')}]`;
    const values = [
      benchmark.id,
      benchmark.category,
      benchmark.contract_family,
      benchmark.jurisdiction,
      benchmark.title,
      benchmark.standard_text,
      benchmark.plain_explanation,
      benchmark.risk_baseline,
      embeddingStr
    ];

    await dbQuery(text, values);
  }
}
