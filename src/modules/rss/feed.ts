import type { RssFeedItem } from './types.js';

const MAX_MESSAGE_LENGTH = 4000;
const MAX_SNIPPET_LENGTH = 500;

export const RSS_MESSAGE_FORMAT = 'html' as const;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function itemKey(item: RssFeedItem): string {
  const guid = item.guid?.trim();
  if (guid) return guid;

  const link = item.link?.trim();
  if (link) return link;

  return `${item.isoDate ?? ''}:${item.title ?? ''}`.trim();
}

export function formatRssMessage(
  item: RssFeedItem,
  includeDescription: boolean,
  options?: { test?: boolean },
): string {
  const title = escapeHtml(item.title?.trim() || 'Новая запись');
  const link = item.link?.trim();

  const lines: string[] = [];
  if (options?.test) {
    lines.push('🧪 <b>Тест RSS</b>');
    lines.push('');
  }

  lines.push(`<b>${title}</b>`);
  if (link) {
    lines.push('', `<a href="${escapeHtml(link)}">${escapeHtml(link)}</a>`);
  }

  if (includeDescription) {
    const snippet = item.contentSnippet?.replace(/\s+/g, ' ').trim();
    if (snippet) {
      const clipped =
        snippet.length > MAX_SNIPPET_LENGTH
          ? `${snippet.slice(0, MAX_SNIPPET_LENGTH)}…`
          : snippet;
      lines.push('', escapeHtml(clipped));
    }
  }

  const text = lines.join('\n');
  if (text.length <= MAX_MESSAGE_LENGTH) return text;
  return `${text.slice(0, MAX_MESSAGE_LENGTH - 1)}…`;
}

/** Новые записи в порядке от старых к новым; при первом запуске — только baseline. */
export function pickNewFeedItems(
  items: RssFeedItem[],
  lastItemKey: string | null,
): { toPost: RssFeedItem[]; nextItemKey: string | null; baselineOnly: boolean } {
  if (items.length === 0) {
    return { toPost: [], nextItemKey: lastItemKey, baselineOnly: false };
  }

  const newestKey = itemKey(items[0]);

  if (!lastItemKey) {
    return { toPost: [], nextItemKey: newestKey, baselineOnly: true };
  }

  const fresh: RssFeedItem[] = [];
  let foundMarker = false;

  for (const item of items) {
    if (itemKey(item) === lastItemKey) {
      foundMarker = true;
      break;
    }
    fresh.push(item);
  }

  if (!foundMarker && fresh.length === items.length) {
    return { toPost: [items[0]], nextItemKey: newestKey, baselineOnly: false };
  }

  return {
    toPost: fresh.reverse(),
    nextItemKey: newestKey,
    baselineOnly: false,
  };
}
