import { getDb } from '../../db/index.js';
import { ensureChat } from '../../db/chats.js';
import { validateRegexPattern } from './matcher.js';
import {
  getTriggerActionLabel,
  normalizeTriggerAction,
  normalizeTriggerMatchType,
  type TriggerAction,
  type TriggerDto,
  type TriggerMatchType,
  type TriggerRow,
} from './types.js';

function toDto(row: TriggerRow): TriggerDto {
  const action = normalizeTriggerAction(row.action);
  return {
    id: row.id,
    chatId: row.chat_id,
    keyPhrase: row.key_phrase,
    responseText: row.response_text,
    matchType: normalizeTriggerMatchType(row.match_type),
    action,
    actionLabel: getTriggerActionLabel(action),
    caseSensitive: row.case_sensitive === 1,
    enabled: row.enabled === 1,
    autoDeleteReply: (row.auto_delete_reply ?? 0) === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateTriggerInput(input: {
  keyPhrase: string;
  responseText?: string;
  action?: TriggerAction;
  matchType?: TriggerMatchType;
  caseSensitive?: boolean;
}): void {
  if (!input.keyPhrase.trim()) {
    throw new Error('KEY_REQUIRED');
  }

  const action = normalizeTriggerAction(input.action);
  if (action !== 'delete' && !input.responseText?.trim()) {
    throw new Error('RESPONSE_REQUIRED');
  }

  const matchType = normalizeTriggerMatchType(input.matchType);
  if (matchType === 'regex') {
    validateRegexPattern(input.keyPhrase, input.caseSensitive ?? false);
  }
}

export function listTriggers(chatId: number): TriggerDto[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM triggers WHERE chat_id = ? ORDER BY created_at DESC, id DESC`,
    )
    .all(chatId) as TriggerRow[];

  return rows.map(toDto);
}

export function getTrigger(id: number): TriggerDto | null {
  const row = getDb()
    .prepare(`SELECT * FROM triggers WHERE id = ?`)
    .get(id) as TriggerRow | undefined;

  return row ? toDto(row) : null;
}

export function createTrigger(input: {
  chatId: number;
  keyPhrase: string;
  responseText?: string;
  matchType?: TriggerMatchType;
  action?: TriggerAction;
  caseSensitive?: boolean;
  enabled?: boolean;
  autoDeleteReply?: boolean;
}): TriggerDto {
  ensureChat(input.chatId);
  const action = normalizeTriggerAction(input.action);
  const matchType = normalizeTriggerMatchType(input.matchType);
  validateTriggerInput({
    keyPhrase: input.keyPhrase,
    responseText: input.responseText,
    action,
    matchType,
    caseSensitive: input.caseSensitive,
  });

  const now = Date.now();

  const result = getDb()
    .prepare(
      `INSERT INTO triggers (
        chat_id, key_phrase, response_text, match_type, action,
        case_sensitive, enabled, auto_delete_reply, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.chatId,
      input.keyPhrase.trim(),
      input.responseText?.trim() ?? '',
      matchType,
      action,
      input.caseSensitive ? 1 : 0,
      input.enabled === false ? 0 : 1,
      input.autoDeleteReply ? 1 : 0,
      now,
      now,
    );

  return getTrigger(Number(result.lastInsertRowid))!;
}

export function updateTrigger(
  id: number,
  input: {
    keyPhrase?: string;
    responseText?: string;
    matchType?: TriggerMatchType;
    action?: TriggerAction;
    caseSensitive?: boolean;
    enabled?: boolean;
    autoDeleteReply?: boolean;
  },
): TriggerDto | null {
  const existing = getTrigger(id);
  if (!existing) return null;

  const merged = {
    keyPhrase: input.keyPhrase !== undefined ? input.keyPhrase : existing.keyPhrase,
    responseText: input.responseText !== undefined ? input.responseText : existing.responseText,
    action: input.action !== undefined ? normalizeTriggerAction(input.action) : existing.action,
    matchType: input.matchType !== undefined ? normalizeTriggerMatchType(input.matchType) : existing.matchType,
    caseSensitive: input.caseSensitive !== undefined ? input.caseSensitive : existing.caseSensitive,
  };

  validateTriggerInput(merged);

  const now = Date.now();
  getDb()
    .prepare(
      `UPDATE triggers SET
        key_phrase = ?,
        response_text = ?,
        match_type = ?,
        action = ?,
        case_sensitive = ?,
        enabled = ?,
        auto_delete_reply = ?,
        updated_at = ?
      WHERE id = ?`,
    )
    .run(
      merged.keyPhrase.trim(),
      merged.responseText.trim(),
      merged.matchType,
      merged.action,
      input.caseSensitive !== undefined ? (input.caseSensitive ? 1 : 0) : existing.caseSensitive ? 1 : 0,
      input.enabled !== undefined ? (input.enabled ? 1 : 0) : existing.enabled ? 1 : 0,
      input.autoDeleteReply !== undefined
        ? (input.autoDeleteReply ? 1 : 0)
        : existing.autoDeleteReply
          ? 1
          : 0,
      now,
      id,
    );

  return getTrigger(id);
}

export function deleteTrigger(id: number): boolean {
  const result = getDb().prepare(`DELETE FROM triggers WHERE id = ?`).run(id);
  return result.changes > 0;
}

export function listEnabledTriggersForChat(chatId: number): TriggerDto[] {
  const rows = getDb()
    .prepare(`SELECT * FROM triggers WHERE chat_id = ? AND enabled = 1`)
    .all(chatId) as TriggerRow[];

  return rows.map(toDto);
}
