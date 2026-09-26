import { v4 as uuidv4 } from 'uuid';
import { validateFileSecurity } from '../../security/file/validator.js';
import { ExtractorFactory } from '../../parsers/extractor.js';
import { TextNormalizer } from '../../normalization/textNormalizer.js';
import { ClauseSegmenter } from '../../parsers/segmenter.js';
import { EntityTokenizer } from '../../normalization/tokenizer.js';
import { DocumentArtifact, ClauseArtifact, DocumentStatus } from '../../types/contracts.js';

export interface IngestionOptions {
  filePath: string;
  originalFilename: string;
  providedMime: string;
  jurisdiction: string;
  documentType: string;
  documentId?: string;
}

export interface IngestionResult {
  documentArtifact: DocumentArtifact;
  clauseArtifacts: ClauseArtifact[];
}

export class IngestionService {
  static async ingest(options: IngestionOptions): Promise<IngestionResult> {
    const documentId = options.documentId || uuidv4();

    // 1. Validate File
    const fileInfo = await validateFileSecurity(
      options.filePath, 
      options.originalFilename, 
      options.providedMime
    );

    // 2. Extract Text
    const extractor = ExtractorFactory.getExtractor(fileInfo.actualMime);
    const extractionResult = await extractor.extract(options.filePath);

    const docStateStatus = extractionResult.isScanned ? 'failed' : 'processing';
    const errorMessage = extractionResult.isScanned ? 'DOCUMENT_REQUIRES_OCR' : undefined;

    // 3. Normalize Document
    const normalizedText = TextNormalizer.normalize(extractionResult.text);

    // 4. Segment Clauses
    const segmented = ClauseSegmenter.segment(normalizedText);

    // 5. Tokenize and Hash Clauses
    const clauseArtifacts: ClauseArtifact[] = segmented.map(seg => {
      const { tokenizedText } = EntityTokenizer.tokenize(seg.rawText);
      const sha256 = EntityTokenizer.hashClause(seg.rawText);

      return {
        id: uuidv4(),
        document_id: documentId,
        location: {
          clause_index: seg.clauseIndex,
          section_number: seg.sectionNumber,
          title: seg.title
        },
        content: {
          raw_text: seg.rawText,
          tokenized_text: tokenizedText,
          sha256
        },
        is_novel_clause: false,
        created_at: new Date().toISOString()
      };
    });

    const documentArtifact: DocumentArtifact = {
      id: documentId,
      metadata: {
        filename: fileInfo.basename,
        file_size_bytes: fileInfo.size,
        mime_type: fileInfo.actualMime,
        jurisdiction: options.jurisdiction,
        document_type: options.documentType,
        is_scanned: extractionResult.isScanned
      },
      state: {
        status: docStateStatus as DocumentStatus,
        progress_percentage: extractionResult.isScanned ? 0 : 10,
        total_clauses: clauseArtifacts.length,
        processed_clauses: 0,
        error_message: errorMessage
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return { documentArtifact, clauseArtifacts };
  }
}
