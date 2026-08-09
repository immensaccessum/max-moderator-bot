import { getDb } from '../../db/index.js';
import { ensureChat } from '../../db/chats.js';
import type { RssFeedDto, RssFeedRow } from './types.js';
import { RSS_MAX_CONSECUTIVE_FAILURES } from './constants.js';

const MIN_POLL_MINUTES = 5;
const MAX_POLL_MINUTES = 24 * 60;

function rowToDto(row: RssFeedRow): RssFeedDto {
  return {
    id: row.id,
    chatId: row.chat_id,
    title: row.title,
    feedUrl: row.feed_url,
    pollIntervalMinutes: row.poll_interval_minutes,
    includeDescription: row.include_description === 1,
    enabled: row.enabled === 1,
    lastItemKey: row.last_item_key,
    lastCheckedAt: row.last_checked_at,
    lastPostedAt: row.last_posted_at,
    lastError: row.last_error,
    failureCount: row.failure_count,
    maxConsecutiveFailures: RSS_MAX_CONSECUTIVE_FAILURES,
    lastChecked: row.last_checked_at
      ? new Date(row.last_checked_at).toLocaleString('ru-RU')
      : null,
    lastPosted: row.last_posted_at
      ? new Date(row.last_posted_at).toLocaleString('ru-RU')
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getRow(id: number): RssFeedRow | null {
  const row = getDb()
    .prepare(`SELECT * FROM rss_feeds WHERE id = ?`)
    .get(id) as RssFeedRow | undefined;
  return row ?? null;
}

export function getRssFeedRow(id: number, chatId: number): RssFeedRow | null {
  const row = getRow(id);
  if (!row || row.chat_id !== chatId) return null;
  return row;
}

export function listRssFeeds(chatId: number): RssFeedDto[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM rss_feeds WHERE chat_id = ? ORDER BY created_at DESC, id DESC`,
    )
    .all(chatId) as RssFeedRow[];

  return rows.map(rowToDto);
}

export function listDueRssFeeds(now = Date.now()): RssFeedRow[] {
  const rows = getDb()
    .prepare(`SELECT * FROM rss_feeds WHERE enabled = 1`)
    .all() as RssFeedRow[];

  return rows.filter((row) => {
    if (row.last_checked_at === null) return true;
    const dueAt = row.last_checked_at + row.poll_interval_minutes * 60_000;
    return now >= dueAt;
  });
}

export function createRssFeed(input: {
  chatId: number;
  title?: string | null;
  feedUrl: string;
  pollIntervalMinutes?: number;
  includeDescription?: boolean;
  enabled?: boolean;
}): RssFeedDto {
  ensureChat(input.chatId);
  validateFeedInput(input);

  const now = Date.now();
  const pollInterval = normalizePollInterval(input.pollIntervalMinutes);

  const result = getDb()
    .prepare(
      `INSERT INTO rss_feeds (
        chat_id, title, feed_url, poll_interval_minutes, include_description,
        enabled, last_item_key, last_checked_at, last_posted_at, last_error, failure_count,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, 0, ?, ?)`,
    )
    .run(
      input.chatId,
      input.title?.trim() || null,
      input.feedUrl.trim(),
      pollInterval,
      input.includeDescription ? 1 : 0,
      input.enabled === false ? 0 : 1,
      now,
      now,
    );

  return rowToDto(getRow(Number(result.lastInsertRowid))!);
}

export function updateRssFeed(
  id: number,
  input: {
    title?: string | null;
    feedUrl?: string;
    pollIntervalMinutes?: number;
    includeDescription?: boolean;
    enabled?: boolean;
  },
): RssFeedDto | null {
  const existing = getRow(id);
  if (!existing) return null;

  const merged = {
    title: input.title !== undefined ? input.title : existing.title,
    feedUrl: input.feedUrl ?? existing.feed_url,
    pollIntervalMinutes:
      input.pollIntervalMinutes !== undefined
        ? input.pollIntervalMinutes
        : existing.poll_interval_minutes,
    includeDescription:
      input.includeDescription !== undefined
        ? input.includeDescription
        : existing.include_description === 1,
    enabled: input.enabled !== undefined ? input.enabled : existing.enabled === 1,
  };

  validateFeedInput({
    chatId: existing.chat_id,
    ...merged,
  });

  const resetFailures =
    input.enabled === true ||
    (input.feedUrl !== undefined && input.feedUrl.trim() !== existing.feed_url);

  const now = Date.now();
  getDb()
    .prepare(
      `UPDATE rss_feeds SET
        title = ?,
        feed_url = ?,
        poll_interval_minutes = ?,
        include_description = ?,
        enabled = ?,
        failure_count = CASE WHEN ? THEN 0 ELSE failure_count END,
        last_error = CASE WHEN ? THEN NULL ELSE last_error END,
        updated_at = ?
      WHERE id = ?`,
    )
    .run(
      merged.title?.trim() || null,
      merged.feedUrl.trim(),
      normalizePollInterval(merged.pollIntervalMinutes),
      merged.includeDescription ? 1 : 0,
      merged.enabled ? 1 : 0,
      resetFailures ? 1 : 0,
      resetFailures ? 1 : 0,
      now,
      id,
    );

  return rowToDto(getRow(id)!);
}

export function deleteRssFeed(id: number): boolean {
  const result = getDb().prepare(`DELETE FROM rss_feeds WHERE id = ?`).run(id);
  return result.changes > 0;
}

export function recordRssFeedSuccess(
  id: number,
  input: {
    lastItemKey?: string | null;
    lastPostedAt?: number | null;
  } = {},
  checkedAt = Date.now(),
): void {
  getDb()
    .prepare(
      `UPDATE rss_feeds SET
        last_checked_at = ?,
        last_item_key = COALESCE(?, last_item_key),
        last_posted_at = COALESCE(?, last_posted_at),
        last_error = NULL,
        failure_count = 0,
        updated_at = ?
      WHERE id = ?`,
    )
    .run(
      checkedAt,
      input.lastItemKey ?? null,
      input.lastPostedAt ?? null,
      checkedAt,
      id,
    );
}

/** @returns true если лента была автоотключена */
export function recordRssFeedFailure(
  id: number,
  errorMessage: string,
  checkedAt = Date.now(),
): boolean {
  const row = getRow(id);
  if (!row) return false;

  const failureCount = row.failure_count + 1;
  const autoDisabled = failureCount >= RSS_MAX_CONSECUTIVE_FAILURES;
  const storedError = autoDisabled
    ? `${errorMessage} (автоотключение после ${failureCount} ошибок подряд)`
    : errorMessage;

  getDb()
    .prepare(
      `UPDATE rss_feeds SET
        last_checked_at = ?,
        last_error = ?,
        failure_count = ?,
        enabled = ?,
        updated_at = ?
      WHERE id = ?`,
    )
    .run(
      checkedAt,
      storedError,
      failureCount,
      autoDisabled ? 0 : row.enabled,
      checkedAt,
      id,
    );

  return autoDisabled;
}

function normalizePollInterval(minutes?: number): number {
  const value = minutes ?? 15;
  if (!Number.isInteger(value) || value < MIN_POLL_MINUTES || value > MAX_POLL_MINUTES) {
    throw new Error('INVALID_POLL_INTERVAL');
  }
  return value;
}

function validateFeedInput(input: {
  chatId: number;
  feedUrl: string;
  pollIntervalMinutes?: number;
}): void {
  normalizePollInterval(input.pollIntervalMinutes);

  try {
    const url = new URL(input.feedUrl.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('INVALID_FEED_URL');
    }
  } catch (err) {
    if (err instanceof Error && err.message === 'INVALID_FEED_URL') {
      throw err;
    }
    throw new Error('INVALID_FEED_URL');
  }
}
