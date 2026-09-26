import { dbQuery } from '../db/connection.js';
import { DocumentStatus } from '../types/document.js';
import { v4 as uuidv4 } from 'uuid';

export interface CreateDocumentParams {
  filename: string;
  file_size_bytes: number;
  mime_type: string;
  content_hash: string;
  raw_text?: string;
}

export interface DocumentRecord {
  id: string;
  filename: string;
  file_size_bytes: number;
  mime_type: string;
  status: DocumentStatus;
  created_at: Date;
}

export const documentRepository = {
  async createDocument(params: CreateDocumentParams): Promise<DocumentRecord> {
    const id = uuidv4();
    const query = `
      INSERT INTO documents (id, filename, file_size_bytes, mime_type, content_hash, raw_text, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'uploaded')
      RETURNING id, filename, file_size_bytes, mime_type, status, created_at;
    `;
    const result = await dbQuery<DocumentRecord>(query, [
      id,
      params.filename,
      params.file_size_bytes,
      params.mime_type,
      params.content_hash,
      params.raw_text || null
    ]);

    // Handle in-memory fallback returning empty array
    if (result.rows.length === 0) {
      return {
        id,
        filename: params.filename,
        file_size_bytes: params.file_size_bytes,
        mime_type: params.mime_type,
        status: 'uploaded',
        created_at: new Date()
      };
    }

    return result.rows[0];
  },

  async getDocumentById(id: string): Promise<any | null> {
    const query = `
      SELECT id as document_id, filename, file_size_bytes, mime_type, status, created_at,
             jurisdiction, document_type, is_scanned
      FROM documents
      WHERE id = $1;
    `;
    const result = await dbQuery<any>(query, [id]);
    if (result.rows.length === 0) return null;
    return result.rows[0];
  },

  async getDocumentByHash(hash: string): Promise<DocumentRecord | null> {
    const query = `
      SELECT id, filename, file_size_bytes, mime_type, status, created_at
      FROM documents
      WHERE content_hash = $1
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    const result = await dbQuery<DocumentRecord>(query, [hash]);
    if (result.rows.length === 0) return null;
    return result.rows[0];
  },

  async updateDocumentStatus(id: string, status: DocumentStatus, errorMessage?: string): Promise<void> {
    const query = `
      UPDATE documents
      SET status = $1, error_message = $2, updated_at = NOW()
      WHERE id = $3;
    `;
    await dbQuery(query, [status, errorMessage || null, id]);
  }
};
