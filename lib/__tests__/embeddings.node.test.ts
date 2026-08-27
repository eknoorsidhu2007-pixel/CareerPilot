import { cosineSimilarity, isEmbeddingsConfigured } from '@/lib/embeddings';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it('returns 0 for mismatched lengths rather than throwing', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it('returns 0 for a zero vector rather than dividing by zero', () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
    expect(Number.isNaN(cosineSimilarity([0, 0], [1, 1]))).toBe(false);
  });

  it('returns 0 for two empty vectors rather than throwing', () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });
});

describe('isEmbeddingsConfigured', () => {
  const originalKey = process.env.GEMINI_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  });

  it('is false when GEMINI_API_KEY is unset', () => {
    delete process.env.GEMINI_API_KEY;
    expect(isEmbeddingsConfigured()).toBe(false);
  });

  it('is false when GEMINI_API_KEY is blank', () => {
    process.env.GEMINI_API_KEY = '   ';
    expect(isEmbeddingsConfigured()).toBe(false);
  });

  it('is true when GEMINI_API_KEY is set', () => {
    process.env.GEMINI_API_KEY = 'test-key';
    expect(isEmbeddingsConfigured()).toBe(true);
  });
});
