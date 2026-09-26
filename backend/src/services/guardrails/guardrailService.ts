import { GuardrailResult } from '../../types/legal.js';
import { logger } from '../../utils/logger.js';

export class GuardrailService {
  private static readonly DISCLAIMER = 
    "\n\n[DISCLAIMER: This information is provided for educational and informational purposes only. It is not legal advice, nor does it create an attorney-client relationship. You should consult a qualified attorney for advice regarding your specific situation.]";

  private static readonly PRESCRIPTIVE_TERMS = [
    /\b(you must not sign)\b/i,
    /\b(this clause is void)\b/i,
    /\b(illegal)\b/i,
    /\b(i advise you to)\b/i,
    /\b(do not sign)\b/i,
    /\b(unenforceable)\b/i
  ];

  private static readonly REPRESENTATION_TERMS = [
    /\b(as your attorney)\b/i,
    /\b(as your lawyer)\b/i,
    /\b(my client)\b/i,
    /\b(attorney-client privilege)\b/i
  ];

  static applyGuardrails(content: string, _type: 'Q&A' | 'CounterDraft' | 'Report'): GuardrailResult {
    let isCompliant = true;
    const flaggedReasons: string[] = [];

    for (const term of this.PRESCRIPTIVE_TERMS) {
      if (term.test(content)) {
        isCompliant = false;
        flaggedReasons.push(`Prescriptive legal command detected: ${term.source}`);
      }
    }

    for (const term of this.REPRESENTATION_TERMS) {
      if (term.test(content)) {
        isCompliant = false;
        flaggedReasons.push(`Representation claim detected: ${term.source}`);
      }
    }
    
    if (!isCompliant) {
      logger.warn('Guardrail violation detected', { flaggedReasons });
    }

    return {
      is_compliant: isCompliant,
      sanitized_content: isCompliant ? content : undefined,
      flagged_reasons: flaggedReasons.length > 0 ? flaggedReasons : undefined
    };
  }

  static validateCounterDraftLabel(content: string): boolean {
    const label = "Educational/sample language - not legal advice";
    const altLabel = "Sample / educational language - not legal advice.";
    return content.toLowerCase().includes(label.toLowerCase()) || content.toLowerCase().includes(altLabel.toLowerCase());
  }
}
