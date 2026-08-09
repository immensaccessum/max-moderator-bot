import { describe, expect, it } from 'vitest';
import { formatRssMessage, itemKey, pickNewFeedItems } from './feed.js';

describe('itemKey', () => {
  it('prefers guid over link', () => {
    expect(itemKey({ guid: 'g1', link: 'https://example.com/a' })).toBe('g1');
  });

  it('falls back to link', () => {
    expect(itemKey({ link: 'https://example.com/a' })).toBe('https://example.com/a');
  });
});

describe('pickNewFeedItems', () => {
  const items = [
    { guid: '3', title: 'Third', isoDate: '2026-01-03' },
    { guid: '2', title: 'Second', isoDate: '2026-01-02' },
    { guid: '1', title: 'First', isoDate: '2026-01-01' },
  ];

  it('sets baseline on first run without posting', () => {
    const result = pickNewFeedItems(items, null);
    expect(result.baselineOnly).toBe(true);
    expect(result.toPost).toHaveLength(0);
    expect(result.nextItemKey).toBe('3');
  });

  it('returns new items oldest-first', () => {
    const result = pickNewFeedItems(items, '1');
    expect(result.toPost.map((item) => item.guid)).toEqual(['2', '3']);
  });

  it('posts only newest when marker is missing', () => {
    const result = pickNewFeedItems(items, 'missing');
    expect(result.toPost).toHaveLength(1);
    expect(result.toPost[0]?.guid).toBe('3');
  });
});

describe('formatRssMessage', () => {
  it('includes bold title and link', () => {
    const text = formatRssMessage(
      { title: 'Hello', link: 'https://example.com/post' },
      false,
    );
    expect(text).toContain('<b>Hello</b>');
    expect(text).toContain('href="https://example.com/post"');
  });

  it('adds snippet when enabled', () => {
    const text = formatRssMessage(
      { title: 'Hello', link: 'https://example.com', contentSnippet: 'Short text' },
      true,
    );
    expect(text).toContain('<b>Hello</b>');
    expect(text).toContain('Short text');
  });

  it('escapes html in title', () => {
    const text = formatRssMessage({ title: 'A & B <script>' }, false);
    expect(text).toContain('<b>A &amp; B &lt;script&gt;</b>');
  });
});
