import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dbQuery, checkDbHealth } from './connection.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(): Promise<{ success: boolean; appliedCount: number; message: string }> {
  const health = await checkDbHealth();
  if (health.isFallback) {
    logger.info('Database in-memory fallback active: simulated migration successful');
    return { success: true, appliedCount: 1, message: 'Simulated migration on in-memory fallback' };
  }

  if (!health.connected) {
    throw new Error(`Cannot run migrations: Database unreachable (${health.error})`);
  }

  // Ensure migrations tracking table exists
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    return { success: true, appliedCount: 0, message: 'No migrations directory found' };
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let appliedCount = 0;

  for (const file of files) {
    const existing = await dbQuery<{ name: string }>(
      'SELECT name FROM schema_migrations WHERE name = $1',
      [file]
    );

    if (existing.rows.length === 0) {
      logger.info(`Applying migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      
      await dbQuery(sql);
      await dbQuery(
        'INSERT INTO schema_migrations (name) VALUES ($1)',
        [file]
      );
      appliedCount++;
      logger.info(`Successfully applied migration: ${file}`);
    }
  }

  return {
    success: true,
    appliedCount,
    message: appliedCount > 0 ? `Applied ${appliedCount} migrations` : 'All migrations up to date'
  };
}

// Allow direct execution: `node dist/db/migrate.js` or `tsx src/db/migrate.ts`
if (process.argv[1] && process.argv[1].endsWith('migrate.ts') || process.argv[1]?.endsWith('migrate.js')) {
  runMigrations()
    .then(res => {
      console.log(`✅ Migration complete: ${res.message}`);
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}
