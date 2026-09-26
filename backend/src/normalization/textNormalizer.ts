export class TextNormalizer {
  static normalize(rawText: string): string {
    if (!rawText) return '';

    let text = rawText;
    
    // 1. Remove non-printable characters (excluding newlines/tabs)
    text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');

    // 2. Normalize whitespace (keep line breaks but collapse multiple spaces)
    text = text.replace(/[ \t\v\f\u00A0]+/g, ' ');

    // 3. Normalize line breaks to standard \n
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 4. Strip more than 3 consecutive newlines down to 2
    text = text.replace(/\n{3,}/g, '\n\n');

    // 5. Trim leading/trailing whitespace
    return text.trim();
  }
}
