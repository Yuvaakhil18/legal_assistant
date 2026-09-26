import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { IngestionService } from '../../../src/services/ingestion/ingestionService.js';
import fs from 'fs';
import path from 'path';

describe('Ingestion Service Orchestration', () => {
  const testDir = path.join(__dirname, 'temp_ingest_test');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir);
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should successfully ingest, normalize, and segment a TXT document', async () => {
    const dummyPath = path.join(testDir, 'contract.txt');
    const content = `1. Confidentiality\nThe receiving party shall keep information secret.\n\n2. Liability\nCap is 100 dollars.`;
    fs.writeFileSync(dummyPath, content);

    const result = await IngestionService.ingest({
      filePath: dummyPath,
      originalFilename: 'contract.txt',
      providedMime: 'text/plain',
      jurisdiction: 'US-General',
      documentType: 'nda'
    });

    expect(result.documentArtifact).toBeDefined();
    expect(result.documentArtifact.metadata.mime_type).toBe('text/plain');
    expect(result.documentArtifact.metadata.is_scanned).toBe(false);
    expect(result.documentArtifact.state.status).toBe('processing');
    
    // We expect 2 clauses
    expect(result.clauseArtifacts.length).toBe(2);
    
    const clause1 = result.clauseArtifacts[0];
    expect(clause1.location.section_number).toBe('1');
    expect(clause1.location.title).toBe('Confidentiality');
    expect(clause1.content.sha256).toHaveLength(64);
  });
});
