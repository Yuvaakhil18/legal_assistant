import { describe, it, expect } from 'vitest';
import { ClauseSegmenter } from '../../../src/parsers/segmenter.js';
import { EntityTokenizer } from '../../../src/normalization/tokenizer.js';
import { TextNormalizer } from '../../../src/normalization/textNormalizer.js';

describe('Document Text Pipeline', () => {
  it('TextNormalizer should clean whitespace and keep meaningful breaks', () => {
    const raw = 'This is \t\t some text.\n\n\n\nIt has   too much whitespace. \r\n';
    const clean = TextNormalizer.normalize(raw);
    expect(clean).toBe('This is some text.\n\nIt has too much whitespace.');
  });

  it('ClauseSegmenter should parse numbered sections', () => {
    const text = '1. Term\nThis is the term clause.\n\nArticle 2. Compensation\nPayment details.\n\nRandom unnumbered paragraph.';
    const segments = ClauseSegmenter.segment(text);
    
    expect(segments.length).toBe(3);
    
    expect(segments[0].sectionNumber).toBe('1');
    expect(segments[0].title).toBe('Term');
    expect(segments[0].rawText).toContain('This is the term clause.');

    expect(segments[1].sectionNumber).toBe('2');
    expect(segments[1].title).toBe('Compensation');
    
    expect(segments[2].sectionNumber).toBeUndefined();
    expect(segments[2].title).toBeUndefined();
  });

  it('ClauseSegmenter should handle malformed numbering gracefully', () => {
    const text = '1..1 Bad Numbering\nContent\n\nSection  NoNumber\nContent 2';
    const segments = ClauseSegmenter.segment(text);
    
    // First one doesn't match standard regex, or maybe it does? 
    // ^(?:Article|Section)?\s*(\d+(?:\.\d+)*)\.?\s*(.*)$
    // "1..1" is not \d+(?:\.\d+)* so it falls back to unnumbered.
    expect(segments[0].sectionNumber).toBeUndefined(); 
  });

  it('EntityTokenizer should deterministically hash text', () => {
    const text1 = 'Standard indemnity clause.';
    const text2 = 'Standard indemnity clause.';
    
    const hash1 = EntityTokenizer.hashClause(text1);
    const hash2 = EntityTokenizer.hashClause(text2);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('EntityTokenizer should mask PII placeholders deterministically', () => {
    const text = 'This Agreement is between Acme Corp and Beta LLC on 01/15/2024.';
    const result = EntityTokenizer.tokenize(text);
    
    // Dates should be captured
    expect(result.tokenizedText).toContain('{{DATE_1}}');
    expect(result.metadataMap['{{DATE_1}}']).toBe('01/15/2024');

    // Party names
    expect(result.tokenizedText).toContain('{{PARTY_1}}');
    expect(result.metadataMap['{{PARTY_1}}']).toBe('Acme Corp');
  });
});
