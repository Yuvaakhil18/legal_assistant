import pg from 'pg';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

export interface QueryResult<T = unknown> {
  rows: T[];
  rowCount: number;
}

let pool: pg.Pool | null = null;
let isInMemoryFallbackActive = false;

// In-Memory storage for fallback mode (no Postgres)
const inMemoryTables: Record<string, Map<string, Record<string, unknown>>> = {
  documents: new Map(),
  clauses: new Map(),
  benchmark_clauses: new Map(),
  clause_benchmarks: new Map(),
  counter_drafts: new Map(),
  gotchas: new Map(),
  checklists: new Map(),
  attorney_briefs: new Map(),
  document_qas: new Map()
};

// Auto-increment for tables without uuid PK
let autoId = 1;
function nextId(): string {
  return `00000000-0000-0000-0000-${String(autoId++).padStart(12, '0')}`;
}

function inMemoryQuery<T>(text: string, params?: unknown[]): QueryResult<T> {
  const sql = text.replace(/\s+/g, ' ').trim();

  // --- INSERT ... RETURNING ---
  const insertMatch = sql.match(/INSERT INTO (\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
  if (insertMatch) {
    const table = insertMatch[1];
    const columns = insertMatch[2].split(',').map(c => c.trim());
    const store = inMemoryTables[table];
    if (!store) return { rows: [], rowCount: 0 };

    const row: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      if (params && i < params.length) {
        row[col] = params[i];
      }
    });

    // If no id was provided, generate one
    if (!row.id) row.id = nextId();
    row.created_at = row.created_at || new Date().toISOString();
    row.updated_at = row.updated_at || new Date().toISOString();
    row.status = row.status || 'uploaded';

    const existingKey = row.id as string;
    // Handle ON CONFLICT - just overwrite/merge
    if (sql.includes('ON CONFLICT')) {
      const existing = store.get(existingKey);
      if (existing) {
        Object.assign(existing, row);
        store.set(existingKey, existing);
        if (sql.includes('RETURNING')) {
          return { rows: [existing as T], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }
    }

    store.set(existingKey, row);

    if (sql.includes('RETURNING')) {
      return { rows: [row as T], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  }

  // --- UPDATE ... WHERE ---
  const updateMatch = sql.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+?)(?:;|$)/is);
  if (updateMatch) {
    const table = updateMatch[1];
    const setClauses = updateMatch[2];
    const store = inMemoryTables[table];
    if (!store) return { rows: [], rowCount: 0 };

    // Find the WHERE id/key parameter - look for the highest $N in WHERE
    const whereParamMatches = updateMatch[3].match(/\$(\d+)/g);
    if (!whereParamMatches || !params) return { rows: [], rowCount: 0 };

    const whereParamIndex = parseInt(whereParamMatches[whereParamMatches.length - 1].substring(1)) - 1;
    const targetId = params[whereParamIndex] as string;

    // Find or create the record
    let record = store.get(targetId);
    if (!record) {
      // For documents, create a stub so updates work after fallback insert
      if (table === 'documents') {
        record = { id: targetId, created_at: new Date().toISOString() };
        store.set(targetId, record);
      } else {
        return { rows: [], rowCount: 0 };
      }
    }

    // Parse SET clause assignments
    const assignments = setClauses.split(/,\s*(?=\w+\s*=)/);
    for (const assignment of assignments) {
      const m = assignment.trim().match(/^(\w+)\s*=\s*(.+)$/);
      if (m) {
        const col = m[1].trim();
        const valExpr = m[2].trim();
        const paramMatch = valExpr.match(/^\$(\d+)$/);
        if (paramMatch && params) {
          record[col] = params[parseInt(paramMatch[1]) - 1];
        } else if (valExpr === 'NOW()') {
          record[col] = new Date().toISOString();
        } else if (valExpr.startsWith("'") && valExpr.endsWith("'")) {
          record[col] = valExpr.slice(1, -1);
        } else if (!isNaN(Number(valExpr))) {
          record[col] = Number(valExpr);
        } else {
          record[col] = valExpr;
        }
      }
    }

    store.set(targetId, record);
    return { rows: [], rowCount: 1 };
  }

  // --- DELETE FROM ... WHERE ---
  const deleteMatch = sql.match(/DELETE FROM (\w+)\s+WHERE\s+(\w+)\s*=\s*\$1/i);
  if (deleteMatch) {
    const table = deleteMatch[1];
    const store = inMemoryTables[table];
    if (!store || !params) return { rows: [], rowCount: 0 };
    const targetVal = params[0] as string;
    const colName = deleteMatch[2];
    let deleted = 0;
    for (const [key, row] of store.entries()) {
      if (row[colName] === targetVal || key === targetVal) {
        store.delete(key);
        deleted++;
      }
    }
    return { rows: [], rowCount: deleted };
  }

  // --- SELECT ... WHERE ---
  const selectMatch = sql.match(/SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+\w+)?\s*(?:LEFT JOIN[^W]*)?WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|;|$)/is);
  if (selectMatch) {
    const table = selectMatch[2];
    const store = inMemoryTables[table];
    if (!store || !params) return { rows: [], rowCount: 0 };

    // Simple filter: match first $1 parameter against WHERE column
    const whereClause = selectMatch[3];
    const whereColMatch = whereClause.match(/(?:\w+\.)?(\w+)\s*=\s*\$(\d+)/);
    if (!whereColMatch) return { rows: [], rowCount: 0 };

    const filterCol = whereColMatch[1];
    const paramIndex = parseInt(whereColMatch[2], 10) - 1;
    const filterVal = params[paramIndex];

    const results: Record<string, unknown>[] = [];
    for (const row of store.values()) {
      if (String(row[filterCol]) === String(filterVal) || String(row.id) === String(filterVal)) {
        results.push({ ...row, cosine_similarity: 0.99 });
      }
    }

    // Handle secondary WHERE condition (e.g., WHERE c.id = $1 AND c.document_id = $2)
    const secondWhere = whereClause.match(/(?:\w+\.)?(\w+)\s*=\s*\$2/);
    if (secondWhere && params.length >= 2) {
      const col2 = secondWhere[1];
      const val2 = params[1] as string;
      const filtered = results.filter(r => r[col2] === val2);
      return { rows: filtered as T[], rowCount: filtered.length };
    }

    // Handle LIMIT
    const limitMatch = sql.match(/LIMIT\s+(\d+|\$\d+)/i);
    if (limitMatch) {
      const limitParam = limitMatch[1];
      let limit: number;
      if (limitParam.startsWith('$')) {
        limit = params[parseInt(limitParam.substring(1)) - 1] as number;
      } else {
        limit = parseInt(limitParam);
      }
      return { rows: results.slice(0, limit) as T[], rowCount: results.length };
    }

    return { rows: results as T[], rowCount: results.length };
  }

  // --- SELECT COUNT ---
  if (sql.match(/SELECT\s+COUNT/i)) {
    // Return 0 count for simplicity
    return { rows: [{ total: 0 } as T], rowCount: 1 };
  }

  // --- SELECT 1 (health check) ---
  if (sql.match(/SELECT\s+1/i)) {
    return { rows: [{ '?column?': 1 } as T], rowCount: 1 };
  }

  // Fallback: no-op
  return { rows: [], rowCount: 0 };
}

export function getDbPool(): pg.Pool | null {
  if (isInMemoryFallbackActive) return null;

  if (!pool) {
    try {
      pool = new Pool({
        connectionString: env.DATABASE_URL,
        connectionTimeoutMillis: 3000,
        idleTimeoutMillis: 10000,
        max: 10
      });

      pool.on('error', (err) => {
        logger.warn('Unexpected error on idle database client', { failureReason: err.message });
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn('Failed to initialize PostgreSQL pool, checking fallback', { failureReason: msg });
      if (env.USE_IN_MEMORY_FALLBACK) {
        isInMemoryFallbackActive = true;
      }
    }
  }
  return pool;
}

export async function checkDbHealth(): Promise<{ connected: boolean; provider: string; isFallback: boolean; error?: string }> {
  if (isInMemoryFallbackActive) {
    return { connected: true, provider: 'in-memory-fallback', isFallback: true };
  }

  const activePool = getDbPool();
  if (!activePool) {
    if (env.USE_IN_MEMORY_FALLBACK) {
      isInMemoryFallbackActive = true;
      return { connected: true, provider: 'in-memory-fallback', isFallback: true };
    }
    return { connected: false, provider: 'postgresql', isFallback: false, error: 'Database pool not initialized' };
  }

  try {
    const client = await activePool.connect();
    try {
      await client.query('SELECT 1');
      return { connected: true, provider: 'postgresql', isFallback: false };
    } finally {
      client.release();
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (env.USE_IN_MEMORY_FALLBACK) {
      logger.info('PostgreSQL unreachable, switching to in-memory fallback', { failureReason: msg });
      isInMemoryFallbackActive = true;
      return { connected: true, provider: 'in-memory-fallback', isFallback: true };
    }
    return { connected: false, provider: 'postgresql', isFallback: false, error: msg };
  }
}

export async function dbQuery<T = unknown>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
  if (isInMemoryFallbackActive) {
    return inMemoryQuery<T>(text, params);
  }

  const activePool = getDbPool();
  if (!activePool) {
    throw new Error('Database pool not available');
  }

  const start = Date.now();
  try {
    const res = await activePool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed DB query', { latencyMs: duration });
    return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Database query error', { failureReason: msg });
    throw err;
  }
}

export function resetDbPool(): void {
  if (pool) {
    pool.end().catch(() => {});
    pool = null;
  }
  isInMemoryFallbackActive = false;
}
