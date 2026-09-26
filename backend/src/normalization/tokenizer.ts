import crypto from 'crypto';

export interface TokenizationResult {
  tokenizedText: string;
  metadataMap: Record<string, string>; // Maps token -> original text
}

export class EntityTokenizer {
  // Extremely basic regex-based deterministic tokenizer for demonstration.
  // In a robust system, this might use NLP (e.g. spaCy), but determinism
  // is mandated for Wave 2A first without AI/LLM.
  static tokenize(text: string): TokenizationResult {
    let tokenizedText = text;
    const metadataMap: Record<string, string> = {};
    let partyCounter = 1;

    // Pattern 1: Capitalized names preceded by "between" and "and" (Very naive heuristic)
    // We will do a generic replacement for placeholder blanks to avoid logging them.
    // e.g. "Name: _________________" -> "{{REDACTED_BLANK}}"
    tokenizedText = tokenizedText.replace(/_{4,}/g, '{{BLANK}}');

    // Deterministic hashing for exact dates (MM/DD/YYYY or similar) to abstract them
    const datePattern = /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g;
    let dateMatch;
    let dateCounter = 1;
    
    // Resetting regex state just in case
    datePattern.lastIndex = 0;
    while ((dateMatch = datePattern.exec(text)) !== null) {
      const originalDate = dateMatch[0];
      const token = `{{DATE_${dateCounter++}}}`;
      metadataMap[token] = originalDate;
      // We do not modify tokenizedText with regex replace all to avoid collisions,
      // but instead do a safe replace.
    }

    // Safely replace collected dates
    for (const [token, original] of Object.entries(metadataMap)) {
      tokenizedText = tokenizedText.split(original).join(token);
    }

    // Pattern 2: Typical defined terms like "Client", "Contractor", "Employee", "Company"
    // We can replace them with {{PARTY_X}} if we want, but let's just use 
    // basic placeholders if they look like explicitly defined parties at the top.
    const partyPattern = /(?<=\b(?:between|by and between)\s+)([A-Z][a-zA-Z\s]+?)(?=\s+(?:and|&)\b)/g;
    
    let partyMatch;
    partyPattern.lastIndex = 0;
    while ((partyMatch = partyPattern.exec(text)) !== null) {
      const originalParty = partyMatch[1].trim();
      if (originalParty.length > 2) {
        const token = `{{PARTY_${partyCounter++}}}`;
        metadataMap[token] = originalParty;
      }
    }

    // Replace parties safely
    for (const [token, original] of Object.entries(metadataMap)) {
      if (token.startsWith('{{PARTY_')) {
        tokenizedText = tokenizedText.split(original).join(token);
      }
    }

    return { tokenizedText, metadataMap };
  }

  static hashClause(text: string): string {
    return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
  }
}
