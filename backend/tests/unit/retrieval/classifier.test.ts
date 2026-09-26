import { describe, it, expect } from 'vitest';
import { CategoryClassifier } from '../../../src/services/retrieval/classifier.js';

describe('Category Classifier', () => {
  it('should accurately classify Indemnification', () => {
    expect(CategoryClassifier.classify('Client shall indemnify and hold harmless...')).toBe('Indemnification');
  });

  it('should accurately classify Limitation of Liability', () => {
    expect(CategoryClassifier.classify('aggregate liability shall not exceed...')).toBe('Limitation of Liability');
  });

  it('should fallback to General for unmatched text', () => {
    expect(CategoryClassifier.classify('This is a completely random paragraph about nothing in particular.')).toBe('General');
  });

  it('should accurately classify Payment Terms', () => {
    expect(CategoryClassifier.classify('Invoices must be paid within net 30 days.')).toBe('Payment Terms');
  });
});
