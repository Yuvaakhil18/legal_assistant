import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { documentRepository } from '../../src/repositories/documentRepository.js';
import * as analysisQueue from '../../src/queue/analysisQueue.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

vi.mock('../../src/repositories/documentRepository.js');
vi.mock('../../src/queue/analysisQueue.js');

describe('Document API Integration', () => {
  const dummyPdfPath = path.join(os.tmpdir(), 'dummy.pdf');
  const dummyTxtPath = path.join(os.tmpdir(), 'dummy.txt');
  const oversizedPath = path.join(os.tmpdir(), 'oversized.pdf');

  beforeEach(() => {
    vi.resetAllMocks();
    
    // Create valid PDF magic bytes
    const pdfBuffer = Buffer.alloc(100);
    pdfBuffer[0] = 0x25; pdfBuffer[1] = 0x50; pdfBuffer[2] = 0x44; pdfBuffer[3] = 0x46;
    fs.writeFileSync(dummyPdfPath, pdfBuffer);

    // Create valid TXT (no strict magic byte for TXT, so anything goes in validator for TXT)
    fs.writeFileSync(dummyTxtPath, Buffer.from('Hello world'));

    // Create oversized PDF (pretend validator will fail based on stat, wait, validator actually checks stat.size)
    // Actually, creating a 10MB file is slow. We can just mock the validator or mock fs.promises.stat.
    // It's easier to let the validator run if we mock the size, but `multer` catches size first!
    // Multer limits at 10MB. We can test multer by sending a large buffer.
  });

  afterEach(() => {
    if (fs.existsSync(dummyPdfPath)) fs.unlinkSync(dummyPdfPath);
    if (fs.existsSync(dummyTxtPath)) fs.unlinkSync(dummyTxtPath);
  });

  describe('POST /api/documents (Upload)', () => {
    it('should successfully upload a valid document (1)', async () => {
      vi.mocked(documentRepository.createDocument).mockResolvedValue({
        id: '123e4567-e89b-12d3-a456-426614174000',
        filename: 'dummy.pdf',
        file_size_bytes: 100,
        mime_type: 'application/pdf',
        status: 'uploaded',
        created_at: new Date()
      });

      vi.spyOn(analysisQueue, 'enqueueContractAnalysis').mockResolvedValue({
        jobId: 'job:doc:123e4567-e89b-12d3-a456-426614174000',
        isFallback: false
      });

      const res = await request(app)
        .post('/api/documents')
        .attach('file', dummyPdfPath);

      expect(res.status).toBe(202);
      expect(res.body.document_id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(res.body.job_id).toBe('job:doc:123e4567-e89b-12d3-a456-426614174000');
      expect(res.body.status).toBe('uploaded');
      
      // 16. request ID propagation
      expect(res.headers['x-request-id']).toBeDefined();
    });

    it('should return existing document if identical hash exists (idempotency)', async () => {
      vi.mocked(documentRepository.getDocumentByHash).mockResolvedValue({
        id: 'existing-id',
        filename: 'dummy.pdf',
        file_size_bytes: 100,
        mime_type: 'application/pdf',
        status: 'analyzed',
        created_at: new Date()
      });

      const res = await request(app)
        .post('/api/documents')
        .attach('file', dummyPdfPath);

      expect(res.status).toBe(202);
      expect(res.body.document_id).toBe('existing-id');
      expect(res.body.job_id).toBe('job:doc:existing-id');
      expect(res.body.status).toBe('analyzed');
      expect(documentRepository.createDocument).not.toHaveBeenCalled();
      expect(analysisQueue.enqueueContractAnalysis).not.toHaveBeenCalled();
    });

    it('should retry existing failed document (idempotency)', async () => {
      vi.mocked(documentRepository.getDocumentByHash).mockResolvedValue({
        id: 'failed-id',
        filename: 'dummy.pdf',
        file_size_bytes: 100,
        mime_type: 'application/pdf',
        status: 'failed',
        created_at: new Date()
      });

      vi.spyOn(analysisQueue, 'enqueueContractAnalysis').mockResolvedValue({
        jobId: 'job:doc:failed-id',
        isFallback: false
      });

      const updateSpy = vi.mocked(documentRepository.updateDocumentStatus).mockResolvedValue();

      const res = await request(app)
        .post('/api/documents')
        .attach('file', dummyPdfPath);

      expect(res.status).toBe(202);
      expect(res.body.document_id).toBe('failed-id');
      expect(res.body.status).toBe('uploaded');
      expect(documentRepository.createDocument).not.toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalledWith('failed-id', 'uploaded', '');
      expect(analysisQueue.enqueueContractAnalysis).toHaveBeenCalled();
    });

    it('should return 400 for missing file (2)', async () => {
      const res = await request(app).post('/api/documents');
      
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(res.body.error.message).toContain('No file uploaded');
      
      // 15. standard error envelope
      expect(res.body.success).toBe(false);
      expect(res.body.disclaimer).toBeDefined();
    });

    it('should return 400 for unsupported extension / MIME (3)', async () => {
      const invalidPath = path.join(os.tmpdir(), 'dummy.exe');
      fs.writeFileSync(invalidPath, Buffer.from('exe'));
      
      const res = await request(app)
        .post('/api/documents')
        .attach('file', invalidPath);
        
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(res.body.error.message).toContain('Unsupported file extension');
      
      fs.unlinkSync(invalidPath);
    });

    it('should return 400 for invalid magic bytes (4)', async () => {
      const badPdfPath = path.join(os.tmpdir(), 'bad.pdf');
      fs.writeFileSync(badPdfPath, Buffer.from('NOT A PDF'));
      
      const res = await request(app)
        .post('/api/documents')
        .attach('file', badPdfPath);
        
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(res.body.error.message).toContain('signature does not match');
      
      fs.unlinkSync(badPdfPath);
    });

    it('should return 413 for oversized file (5)', async () => {
      // Mock multer size limit or stat size
      // We will create a small file, but mock fs.promises.stat to return a huge size
      const statSpy = vi.spyOn(fs.promises, 'stat').mockResolvedValue({ size: 15 * 1024 * 1024 } as any);
      
      const res = await request(app)
        .post('/api/documents')
        .attach('file', dummyPdfPath);
        
      expect(res.status).toBe(413);
      expect(res.body.error.code).toBe('FILE_TOO_LARGE');
      
      statSpy.mockRestore();
    });

    it('should handle document creation failure (8)', async () => {
      vi.mocked(documentRepository.createDocument).mockRejectedValue(new Error('DB Error'));

      const res = await request(app)
        .post('/api/documents')
        .attach('file', dummyPdfPath);

      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should handle queue failure and update document status (9)', async () => {
      vi.mocked(documentRepository.createDocument).mockResolvedValue({
        id: 'doc-999',
        filename: 'dummy.pdf',
        file_size_bytes: 100,
        mime_type: 'application/pdf',
        status: 'uploaded',
        created_at: new Date()
      });

      vi.spyOn(analysisQueue, 'enqueueContractAnalysis').mockRejectedValue(new Error('Queue Error'));
      const updateSpy = vi.mocked(documentRepository.updateDocumentStatus).mockResolvedValue();

      const res = await request(app)
        .post('/api/documents')
        .attach('file', dummyPdfPath);

      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(updateSpy).toHaveBeenCalledWith('doc-999', 'failed', 'Queue Error');
    });
  });

  // GET tests have been moved to documentReadApi.test.ts
});
