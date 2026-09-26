import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { validateFileSecurity } from '../../../src/security/file/validator.js';
import fs from 'fs';
import path from 'path';

describe('File Validator', () => {
  const testDir = path.join(__dirname, 'temp_test_files');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir);
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should reject path traversal in filenames', async () => {
    const dummyPath = path.join(testDir, 'dummy.txt');
    fs.writeFileSync(dummyPath, 'test');
    
    await expect(validateFileSecurity(dummyPath, '../../../etc/passwd', 'text/plain'))
      .rejects.toThrow('Invalid filename or path traversal detected');
  });

  it('should reject null bytes in filenames', async () => {
    const dummyPath = path.join(testDir, 'dummy.txt');
    fs.writeFileSync(dummyPath, 'test');
    
    await expect(validateFileSecurity(dummyPath, 'test.pdf\0.exe', 'text/plain'))
      .rejects.toThrow('Invalid filename: null byte detected');
  });

  it('should reject unsupported extensions', async () => {
    const dummyPath = path.join(testDir, 'dummy.exe');
    fs.writeFileSync(dummyPath, 'MZ...');
    
    await expect(validateFileSecurity(dummyPath, 'malware.exe', 'application/x-msdownload'))
      .rejects.toThrow('Unsupported file extension: .exe');
  });

  it('should detect MIME spoofing (TXT renamed to PDF)', async () => {
    const dummyPath = path.join(testDir, 'spoof.pdf');
    // Write text data instead of %PDF
    fs.writeFileSync(dummyPath, 'Just some plain text data');
    
    await expect(validateFileSecurity(dummyPath, 'spoof.pdf', 'application/pdf'))
      .rejects.toThrow('File signature does not match PDF');
  });

  it('should pass valid TXT', async () => {
    const dummyPath = path.join(testDir, 'valid.txt');
    fs.writeFileSync(dummyPath, 'Valid text document content.');
    
    const result = await validateFileSecurity(dummyPath, 'valid.txt', 'text/plain');
    expect(result.valid).toBe(true);
    expect(result.actualMime).toBe('text/plain');
  });

  it('should pass valid PDF signature', async () => {
    const dummyPath = path.join(testDir, 'valid.pdf');
    // %PDF-1.4...
    const pdfBytes = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]); 
    fs.writeFileSync(dummyPath, pdfBytes);
    
    const result = await validateFileSecurity(dummyPath, 'valid.pdf', 'application/pdf');
    expect(result.valid).toBe(true);
    expect(result.actualMime).toBe('application/pdf');
  });
});
