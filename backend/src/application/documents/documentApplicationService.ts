import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { validateFileSecurity } from '../../security/file/validator.js';
import { documentRepository } from '../../repositories/documentRepository.js';
import { enqueueContractAnalysis } from '../../queue/analysisQueue.js';
import { DocumentStatus } from '../../types/document.js';
import { logger } from '../../utils/logger.js';

export interface UploadDocumentResponse {
  document_id: string;
  job_id: string;
  status: DocumentStatus;
}

export const documentApplicationService = {
  async processUpload(filePath: string, originalFilename: string, providedMime: string): Promise<UploadDocumentResponse> {
    // 1. Validate file
    const validationResult = await validateFileSecurity(filePath, originalFilename, providedMime);

    // 2. Generate content hash
    const fileBuffer = await fs.promises.readFile(filePath);
    const contentHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    let docId = '';
    let docStatus: DocumentStatus = 'uploaded';

    // 2.5 Idempotency check: if document already exists
    const existingDoc = await documentRepository.getDocumentByHash(contentHash);
    if (existingDoc) {
      if (existingDoc.status !== 'failed') {
        // Return successful or pending document immediately
        try { await fs.promises.unlink(filePath); } catch (err) {}
        return {
          document_id: existingDoc.id,
          job_id: `job:doc:${existingDoc.id}`,
          status: existingDoc.status
        };
      } else {
        // Retry failed document: update status to uploaded
        docId = existingDoc.id;
        await documentRepository.updateDocumentStatus(docId, 'uploaded', '');
      }
    } else {
      // 3. Persist new document metadata
      const doc = await documentRepository.createDocument({
        filename: validationResult.basename,
        file_size_bytes: validationResult.size,
        mime_type: validationResult.actualMime,
        content_hash: contentHash
      });
      docId = doc.id;
    }

    // Move temp file to deterministic location BEFORE enqueueing,
    // so the orchestrator can find it whether sync or async
    const targetPath = path.join(os.tmpdir(), `doc_${docId}`);
    try {
      await fs.promises.rename(filePath, targetPath);
    } catch {
      try {
        await fs.promises.copyFile(filePath, targetPath);
        await fs.promises.unlink(filePath);
      } catch { /* best effort */ }
    }

    try {
      // 4. Enqueue Job
      const jobResult = await enqueueContractAnalysis({
        job_id: `job:doc:${docId}`,
        document_id: docId,
        jurisdiction: 'General Commercial',
        document_type: 'general_contract',
        priority: 1
      });

      // When no real worker is available (in-memory fallback),
      // run the full analysis pipeline synchronously
      if (jobResult.isFallback) {
        const { AnalysisJobOrchestrator } = await import('../../services/analysis/analysisOrchestrator.js');
        const orchestrator = new AnalysisJobOrchestrator();
        try {
          await orchestrator.execute({
            job_id: jobResult.jobId,
            document_id: docId,
            jurisdiction: 'General Commercial',
            document_type: 'general_contract',
            priority: 1
          });
          docStatus = 'analyzed' as DocumentStatus;
        } catch (orchErr) {
          const msg = orchErr instanceof Error ? orchErr.message : String(orchErr);
          logger.error('Fallback analysis pipeline failed', { documentId: docId, failureReason: msg });
          await documentRepository.updateDocumentStatus(docId, 'failed', msg);
          docStatus = 'failed' as DocumentStatus;
        }
      }

      return {
        document_id: docId,
        job_id: jobResult.jobId,
        status: docStatus
      };
    } catch (error) {
      // 5. Handle enqueue failure
      const errorMsg = error instanceof Error ? error.message : 'Unknown queue error';
      await documentRepository.updateDocumentStatus(docId, 'failed', errorMsg);
      throw new Error(`Failed to enqueue job: ${errorMsg}`);
    }
  },

  async getDocument(id: string) {
    const doc = await documentRepository.getDocumentById(id);
    if (!doc) return null;
    return doc;
  }
};
