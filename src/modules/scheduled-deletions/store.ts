import { getDb } from '../../db/index.js';
import { ensureChat } from '../../db/chats.js';
import type { ScheduledDeletionRow } from './types.js';

export function insertScheduledDeletion(input: {
  chatId: number;
  messageId: string;
  messageText?: string | null;
  source: string;
  sourceDetail?: string | null;
  dueAt: number;
}): number {
  ensureChat(input.chatId);
  const now = Date.now();

  const result = getDb()
    .prepare(
      `INSERT INTO scheduled_deletions (
        chat_id, message_id, message_text, source, source_detail, due_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.chatId,
      input.messageId,
      input.messageText ?? null,
      input.source,
      input.sourceDetail ?? null,
      input.dueAt,
      now,
    );

  return Number(result.lastInsertRowid);
}

export function listDueScheduledDeletions(now = Date.now(), limit = 100): ScheduledDeletionRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM scheduled_deletions
       WHERE due_at <= ?
       ORDER BY due_at ASC, id ASC
       LIMIT ?`,
    )
    .all(now, limit) as ScheduledDeletionRow[];
}

export function deleteScheduledDeletion(id: number): void {
  getDb().prepare(`DELETE FROM scheduled_deletions WHERE id = ?`).run(id);
}
