import { ClauseType } from '../../types/contracts.js';

export class CategoryClassifier {
  static classify(text: string): ClauseType {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('indemnify') || lowerText.includes('indemnification') || lowerText.includes('hold harmless')) {
      return 'Indemnification';
    }
    if (lowerText.includes('liability') || lowerText.includes('aggregate liability') || lowerText.includes('damages')) {
      return 'Limitation of Liability';
    }
    if (lowerText.includes('terminate') || lowerText.includes('termination') || lowerText.includes('survive')) {
      return 'Termination';
    }
    if (lowerText.includes('compete') || lowerText.includes('non-compete') || lowerText.includes('solicit')) {
      return 'Non-Compete';
    }
    if (lowerText.includes('intellectual property') || lowerText.includes('invention') || lowerText.includes('ip rights')) {
      return 'IP Assignment';
    }
    if (lowerText.includes('confidential') || lowerText.includes('non-disclosure') || lowerText.includes('proprietary')) {
      return 'Confidentiality';
    }
    if (lowerText.includes('payment') || lowerText.includes('invoice') || lowerText.includes('net 30')) {
      return 'Payment Terms';
    }
    if (lowerText.includes('arbitration') || lowerText.includes('dispute') || lowerText.includes('venue') || lowerText.includes('jurisdiction')) {
      return 'Dispute Resolution';
    }

    return 'General';
  }
}
