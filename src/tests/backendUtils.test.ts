import { describe, it, expect } from 'vitest';
import { chunkCode, cosineSimilarity } from '../backendUtils';

describe('backendUtils', () => {
  describe('chunkCode', () => {
    it('should split code into chunks', () => {
      const file = {
        name: 'test.ts',
        path: 'test.ts',
        size: 100,
        content: 'line1\nline2\n'.repeat(50) // 100 lines
      };
      const chunks = chunkCode(file, 'p1');
      expect(chunks.length).toBeGreaterThan(1);
    });
  });

  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const vec = [1, 2, 3];
      expect(cosineSimilarity(vec, vec)).toBeCloseTo(1);
    });

    it('should return 0 for orthogonal vectors', () => {
      const vecA = [1, 0];
      const vecB = [0, 1];
      expect(cosineSimilarity(vecA, vecB)).toBe(0);
    });
  });
});
