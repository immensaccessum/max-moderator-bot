import { getDb } from '../../db/index.js';
import { ensureChat } from '../../db/chats.js';
import { AUTOPOST_MAX_MESSAGE_LENGTH } from './constants.js';
import { getTimezoneOrDefault } from '../silence/schedule.js';
import { toAutopostDto } from './schedule.js';
import type { AutopostDto, AutopostRow, AutopostScheduleType } from './types.js';

function getRow(id: number): AutopostRow | null {
  const row = getDb()
    .prepare(`SELECT * FROM autopost_schedules WHERE id = ?`)
    .get(id) as AutopostRow | undefined;

  return row ?? null;
}

export function listAutoposts(chatId: number): AutopostDto[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM autopost_schedules WHERE chat_id = ? ORDER BY created_at DESC, id DESC`,
    )
    .all(chatId) as AutopostRow[];

  return rows.map(toAutopostDto);
}

export function listEnabledAutoposts(): AutopostRow[] {
  return getDb()
    .prepare(`SELECT * FROM autopost_schedules WHERE enabled = 1`)
    .all() as AutopostRow[];
}

export function createAutopost(input: {
  chatId: number;
  title?: string | null;
  messageText: string;
  scheduleType: AutopostScheduleType;
  weekday?: number | null;
  hour?: number | null;
  minute?: number | null;
  intervalMinutes?: number | null;
  timezone?: string | null;
  enabled?: boolean;
}): AutopostDto {
  ensureChat(input.chatId);
  validateAutopostInput(input);

  const now = Date.now();
  const result = getDb()
    .prepare(
      `INSERT INTO autopost_schedules (
        chat_id, title, message_text, schedule_type,
        weekday, hour, minute, interval_minutes, timezone,
        enabled, last_posted_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    )
    .run(
      input.chatId,
      input.title?.trim() || null,
      input.messageText.trim(),
      input.scheduleType,
      input.weekday ?? null,
      input.hour ?? null,
      input.minute ?? null,
      input.intervalMinutes ?? null,
      getTimezoneOrDefault(input.timezone),
      input.enabled === false ? 0 : 1,
      now,
      now,
    );

  return toAutopostDto(getRow(Number(result.lastInsertRowid))!);
}

export function updateAutopost(
  id: number,
  input: {
    title?: string | null;
    messageText?: string;
    scheduleType?: AutopostScheduleType;
    weekday?: number | null;
    hour?: number | null;
    minute?: number | null;
    intervalMinutes?: number | null;
    timezone?: string | null;
    enabled?: boolean;
  },
): AutopostDto | null {
  const existing = getRow(id);
  if (!existing) return null;

  const merged = {
    chatId: existing.chat_id,
    title: input.title !== undefined ? input.title : existing.title,
    messageText: input.messageText ?? existing.message_text,
    scheduleType: input.scheduleType ?? existing.schedule_type,
    weekday: input.weekday !== undefined ? input.weekday : existing.weekday,
    hour: input.hour !== undefined ? input.hour : existing.hour,
    minute: input.minute !== undefined ? input.minute : existing.minute,
    intervalMinutes:
      input.intervalMinutes !== undefined ? input.intervalMinutes : existing.interval_minutes,
    timezone: input.timezone !== undefined ? input.timezone : existing.timezone,
    enabled: input.enabled !== undefined ? input.enabled : existing.enabled === 1,
  };

  validateAutopostInput(merged);

  const now = Date.now();
  getDb()
    .prepare(
      `UPDATE autopost_schedules SET
        title = ?,
        message_text = ?,
        schedule_type = ?,
        weekday = ?,
        hour = ?,
        minute = ?,
        interval_minutes = ?,
        timezone = ?,
        enabled = ?,
        updated_at = ?
      WHERE id = ?`,
    )
    .run(
      merged.title?.trim() || null,
      merged.messageText.trim(),
      merged.scheduleType,
      merged.weekday,
      merged.hour,
      merged.minute,
      merged.intervalMinutes,
      getTimezoneOrDefault(merged.timezone),
      merged.enabled ? 1 : 0,
      now,
      id,
    );

  return toAutopostDto(getRow(id)!);
}

export function deleteAutopost(id: number): boolean {
  const result = getDb().prepare(`DELETE FROM autopost_schedules WHERE id = ?`).run(id);
  return result.changes > 0;
}

export function markAutopostPosted(id: number, postedAt = Date.now()): void {
  getDb()
    .prepare(
      `UPDATE autopost_schedules SET last_posted_at = ?, updated_at = ? WHERE id = ?`,
    )
    .run(postedAt, postedAt, id);
}

function validateAutopostInput(input: {
  messageText: string;
  scheduleType: AutopostScheduleType;
  weekday?: number | null;
  hour?: number | null;
  minute?: number | null;
  intervalMinutes?: number | null;
}): void {
  if (!input.messageText.trim()) {
    throw new Error('MESSAGE_REQUIRED');
  }

  if (input.messageText.trim().length > AUTOPOST_MAX_MESSAGE_LENGTH) {
    throw new Error('MESSAGE_TOO_LONG');
  }

  if (input.scheduleType === 'interval') {
    const minutes = input.intervalMinutes ?? 0;
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 60 * 24 * 7) {
      throw new Error('INVALID_INTERVAL');
    }
    return;
  }

  const hour = input.hour ?? -1;
  const minute = input.minute ?? -1;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error('INVALID_TIME');
  }

  if (input.scheduleType === 'weekly') {
    const weekday = input.weekday ?? -1;
    if (weekday < 0 || weekday > 6) {
      throw new Error('INVALID_WEEKDAY');
    }
  }
}
