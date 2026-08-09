import { describe, expect, it } from 'vitest';
import { matchesTrigger } from './matcher.js';

describe('matchesTrigger', () => {
  it('matches contains case-insensitively by default', () => {
    expect(matchesTrigger('Продано товар', 'продано', 'contains', false)).toBe(true);
    expect(matchesTrigger('Продано товар', 'ПРОДАНО', 'contains', false)).toBe(true);
  });

  it('matches exact only for full text', () => {
    expect(matchesTrigger('продано', 'продано', 'exact', false)).toBe(true);
    expect(matchesTrigger('уже продано', 'продано', 'exact', false)).toBe(false);
  });

  it('respects case sensitivity', () => {
    expect(matchesTrigger('Продано', 'продано', 'contains', true)).toBe(false);
    expect(matchesTrigger('Продано', 'Продано', 'contains', true)).toBe(true);
  });

  it('matches regex patterns', () => {
    expect(matchesTrigger('продано', '^продано$', 'regex', false)).toBe(true);
    expect(matchesTrigger('не продано', '^продано$', 'regex', false)).toBe(false);
  });

  it('returns false for empty input', () => {
    expect(matchesTrigger('', 'test', 'contains', false)).toBe(false);
    expect(matchesTrigger('hello', '', 'contains', false)).toBe(false);
  });
});
