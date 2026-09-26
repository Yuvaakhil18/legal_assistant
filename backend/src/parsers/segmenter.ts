export interface SegmentedClause {
  clauseIndex: number;
  sectionNumber?: string;
  title?: string;
  rawText: string;
}

export class ClauseSegmenter {
  static segment(text: string): SegmentedClause[] {
    const clauses: SegmentedClause[] = [];
    
    // Split by paragraphs (double newlines)
    const blocks = text.split(/\n\n+/);
    
    let currentClauseIndex = 1;

    // Common legal numbering regex:
    // "1.", "1.1", "Article 1", "Section 1.1", "1.1."
    // Requires either a dot followed by space, or just space after the number to avoid matching "1..1" as "1"
    const headerRegex = /^(?:Article|Section)?\s*(\d+(?:\.\d+)*)(?:\.\s+|\s+)(.*)$/i;

    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;

      // Extract first line to check if it's a header
      const lines = trimmed.split('\n');
      const firstLine = lines[0].trim();

      const match = headerRegex.exec(firstLine);
      if (match) {
        const sectionNumber = match[1];
        let title = match[2].trim();
        
        let content = trimmed;
        // If the first line is ONLY the header, the content is the rest
        if (title && lines.length === 1) {
          // Then there's no immediate text content, wait for next block?
          // For simplicity, we just keep the whole block as the rawText.
        }

        clauses.push({
          clauseIndex: currentClauseIndex++,
          sectionNumber,
          title: title || undefined,
          rawText: content
        });
      } else {
        // Just a standard paragraph/subclause without clear numbering
        clauses.push({
          clauseIndex: currentClauseIndex++,
          rawText: trimmed
        });
      }
    }

    return clauses;
  }
}
