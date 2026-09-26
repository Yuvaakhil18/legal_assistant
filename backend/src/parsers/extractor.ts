import fs from 'fs';
// @ts-ignore
import { PDFParse } from 'pdf-parse';

export interface ExtractionResult {
  text: string;
  pageCount: number;
  metadata?: Record<string, unknown>;
  isScanned: boolean;
}

export interface DocumentExtractor {
  extract(filePath: string): Promise<ExtractionResult>;
}

export class PdfExtractor implements DocumentExtractor {
  async extract(filePath: string): Promise<ExtractionResult> {
    const dataBuffer = await fs.promises.readFile(filePath);
    
    let text = '';
    let pageCount = 1;
    let metadata: Record<string, unknown> = {};

    try {
      const parser = new PDFParse({ data: dataBuffer });
      await (parser as any).load();
      
      const result = await parser.getText();
      text = typeof result === 'string' ? result : (result as any).text || '';
      
      // In PDFParse v2, page count is in doc.numPages
      pageCount = (parser as any).doc?.numPages || 1;
      
      try {
        metadata = await (parser as any).getInfo() || {};
      } catch {
        // ignore metadata errors
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`PDF Parsing failed: ${msg}`);
    }

    // Scanned PDF detection: if < 50 chars per page, it's likely a scanned image requiring OCR.
    const charsPerPage = text.length / pageCount;
    const isScanned = charsPerPage < 50;

    return {
      text,
      pageCount,
      metadata,
      isScanned
    };
  }
}

export class TxtExtractor implements DocumentExtractor {
  async extract(filePath: string): Promise<ExtractionResult> {
    const text = await fs.promises.readFile(filePath, 'utf8');
    
    return {
      text,
      pageCount: 1, // TXT has no pages
      isScanned: false
    };
  }
}

export class DocxExtractor implements DocumentExtractor {
  async extract(_filePath: string): Promise<ExtractionResult> {
    // Basic placeholder for DOCX. Mammouth or similar would go here.
    throw new Error('DOCX extraction not yet implemented in Wave 2A.');
  }
}

export class ExtractorFactory {
  static getExtractor(mimeType: string): DocumentExtractor {
    if (mimeType === 'application/pdf') return new PdfExtractor();
    if (mimeType === 'text/plain') return new TxtExtractor();
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return new DocxExtractor();
    throw new Error(`Unsupported MIME type for extraction: ${mimeType}`);
  }
}
