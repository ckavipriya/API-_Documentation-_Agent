import { describe, it, expect } from 'vitest';
import { cosineSimilarity } from '../backendUtils';

describe('RAG Chat Logic', () => {
  it('should compute similarity scores', () => {
    // Testing the core matching logic which is already in backendUtils
    const query = [1, 0, 0];
    const chunk1 = [1, 0, 0];
    const chunk2 = [0, 1, 0];
    
    expect(cosineSimilarity(query, chunk1)).toBeCloseTo(1);
    expect(cosineSimilarity(query, chunk2)).toBe(0);
  });
});
