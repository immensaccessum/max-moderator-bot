import { getDb } from '../../db/index.js';
import {
  DELETION_RETENTION_MS,
  DELETION_SOURCE_LABELS,
  type DeletionEventType,
  type DeletionLogDto,
  type DeletionLogRow,
  type DeletionSource,
  normalizeDeletionSource,
} from './types.js';

const MAX_MESSAGE_TEXT_LENGTH = 2000;

function truncateText(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length <= MAX_MESSAGE_TEXT_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_MESSAGE_TEXT_LENGTH)}…`;
}

function toDto(row: DeletionLogRow): DeletionLogDto {
  return {
    id: row.id,
    chatId: row.chat_id,
    messageId: row.message_id,
    userId: row.user_id,
    userLabel: row.user_label,
    messageText: row.message_text,
    source: normalizeDeletionSource(row.source),
    sourceLabel: DELETION_SOURCE_LABELS[normalizeDeletionSource(row.source)],
    sourceDetail: row.source_detail,
    eventType: row.event_type,
    success: row.success === 1,
    errorMessage: row.error_message,
    deletedAt: row.deleted_at,
  };
}

export function recordDeletion(input: {
  chatId: number;
  messageId?: string | null;
  userId?: number | null;
  userLabel?: string | null;
  messageText?: string | null;
  source: DeletionSource;
  sourceDetail?: string | null;
  eventType?: DeletionEventType;
  success: boolean;
  errorMessage?: string | null;
  deletedAt?: number;
}): DeletionLogDto {
  const deletedAt = input.deletedAt ?? Date.now();

  const result = getDb()
    .prepare(
      `INSERT INTO deletion_logs (
        chat_id, message_id, user_id, user_label, message_text,
        source, source_detail, event_type, success, error_message, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.chatId,
      input.messageId ?? null,
      input.userId ?? null,
      input.userLabel ?? null,
      truncateText(input.messageText),
      input.source,
      input.sourceDetail ?? null,
      input.eventType ?? 'message_created',
      input.success ? 1 : 0,
      input.errorMessage ?? null,
      deletedAt,
    );

  const row = getDb()
    .prepare(`SELECT * FROM deletion_logs WHERE id = ?`)
    .get(Number(result.lastInsertRowid)) as DeletionLogRow;

  return toDto(row);
}

export function listDeletionLogs(chatId: number, limit = 200): DeletionLogDto[] {
  const since = Date.now() - DELETION_RETENTION_MS;
  const rows = getDb()
    .prepare(
      `SELECT * FROM deletion_logs
       WHERE chat_id = ? AND deleted_at >= ?
       ORDER BY deleted_at DESC, id DESC
       LIMIT ?`,
    )
    .all(chatId, since, limit) as DeletionLogRow[];

  return rows.map(toDto);
}

export function purgeExpiredDeletionLogs(now = Date.now()): number {
  const cutoff = now - DELETION_RETENTION_MS;
  const result = getDb()
    .prepare(`DELETE FROM deletion_logs WHERE deleted_at < ?`)
    .run(cutoff);
  return result.changes;
}
