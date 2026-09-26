import fs from 'fs';
import path from 'path';

export class FileSecurityError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'FileSecurityError';
  }
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.txt', '.docx']);

export const validateFileSecurity = async (filePath: string, originalFilename: string, _providedMime: string) => {
  // 1. Path traversal & dangerous filename guard
  if (originalFilename.includes('\0')) {
    throw new FileSecurityError('Invalid filename: null byte detected', 'INVALID_FILENAME');
  }

  const basename = path.basename(originalFilename);
  if (basename !== originalFilename || basename.includes('..') || basename.includes('/')) {
    throw new FileSecurityError('Invalid filename or path traversal detected', 'INVALID_FILENAME');
  }

  // 2. Extension check
  const ext = path.extname(basename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new FileSecurityError(`Unsupported file extension: ${ext}`, 'UNSUPPORTED_EXTENSION');
  }

  // 3. Size check
  const stat = await fs.promises.stat(filePath);
  if (stat.size > MAX_FILE_SIZE) {
    throw new FileSecurityError('File exceeds maximum allowed size of 10MB', 'FILE_TOO_LARGE');
  }
  if (stat.size === 0) {
    throw new FileSecurityError('File is empty', 'FILE_EMPTY');
  }

  // 4. Magic bytes validation (Never trust client MIME)
  const fd = await fs.promises.open(filePath, 'r');
  const buffer = Buffer.alloc(8);
  await fd.read(buffer, 0, 8, 0);
  await fd.close();

  const isPdf = buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46; // %PDF
  const isDocx = buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04; // PK\x03\x04
  
  // TXT files don't have a single magic byte sequence, but we can check if it's purely textual.
  // For simplicity, we ensure PDF/DOCX have correct headers.
  if (ext === '.pdf' && !isPdf) {
    throw new FileSecurityError('File signature does not match PDF', 'MAGIC_BYTE_MISMATCH');
  }
  if (ext === '.docx' && !isDocx) {
    throw new FileSecurityError('File signature does not match DOCX', 'MAGIC_BYTE_MISMATCH');
  }

  // Determine actual MIME
  let actualMime = 'text/plain';
  if (isPdf) actualMime = 'application/pdf';
  if (isDocx) actualMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  return {
    valid: true,
    actualMime,
    size: stat.size,
    basename
  };
};
