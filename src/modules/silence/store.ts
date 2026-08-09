import { getDb } from '../../db/index.js';
import { ensureChat } from '../../db/chats.js';
import {
  DEFAULT_DURATION_PRESETS,
  normalizeDurationPresets,
  type SilenceDurationPreset,
} from './constants.js';
import {
  DEFAULT_SCHEDULE_END_MINUTES,
  DEFAULT_SCHEDULE_START_MINUTES,
  getTimezoneOrDefault,
} from './schedule.js';

export type SilenceSettings = {
  enabled: boolean;
  untilMs: number | null;
  openSuffix: string | null;
  closedSuffix: string | null;
  durationPresets: SilenceDurationPreset[];
  scheduleEnabled: boolean;
  scheduleStartMinutes: number;
  scheduleEndMinutes: number;
  scheduleTimezone: string | null;
  scheduleWeekendsEnabled: boolean;
};

type SilenceRow = {
  enabled: number;
  until_ms: number | null;
  open_suffix: string | null;
  closed_suffix: string | null;
  duration_presets: string | null;
  schedule_enabled: number | null;
  schedule_start_minutes: number | null;
  schedule_end_minutes: number | null;
  schedule_timezone: string | null;
  schedule_weekends_enabled: number | null;
};

function parseDurationPresets(raw: string | null): SilenceDurationPreset[] {
  if (!raw) {
    return normalizeDurationPresets(DEFAULT_DURATION_PRESETS);
  }

  try {
    const parsed = JSON.parse(raw) as SilenceDurationPreset[];
    return normalizeDurationPresets(parsed);
  } catch {
    return normalizeDurationPresets(DEFAULT_DURATION_PRESETS);
  }
}

function rowToSettings(row: SilenceRow | undefined): SilenceSettings {
  if (!row) {
    return createDefaultSettings();
  }

  return {
    enabled: row.enabled === 1,
    untilMs: row.until_ms,
    openSuffix: row.open_suffix,
    closedSuffix: row.closed_suffix,
    durationPresets: parseDurationPresets(row.duration_presets),
    scheduleEnabled: row.schedule_enabled === 1,
    scheduleStartMinutes: row.schedule_start_minutes ?? DEFAULT_SCHEDULE_START_MINUTES,
    scheduleEndMinutes: row.schedule_end_minutes ?? DEFAULT_SCHEDULE_END_MINUTES,
    scheduleTimezone: row.schedule_timezone,
    scheduleWeekendsEnabled: row.schedule_weekends_enabled === 1,
  };
}

function createDefaultSettings(): SilenceSettings {
  return {
    enabled: false,
    untilMs: null,
    openSuffix: null,
    closedSuffix: null,
    durationPresets: normalizeDurationPresets(DEFAULT_DURATION_PRESETS),
    scheduleEnabled: false,
    scheduleStartMinutes: DEFAULT_SCHEDULE_START_MINUTES,
    scheduleEndMinutes: DEFAULT_SCHEDULE_END_MINUTES,
    scheduleTimezone: null,
    scheduleWeekendsEnabled: false,
  };
}

const SELECT_COLUMNS = `
  enabled, until_ms, open_suffix, closed_suffix, duration_presets,
  schedule_enabled, schedule_start_minutes, schedule_end_minutes, schedule_timezone,
  schedule_weekends_enabled
`;

function getRow(chatId: number): SilenceRow | undefined {
  return getDb()
    .prepare(`SELECT ${SELECT_COLUMNS} FROM silence_settings WHERE chat_id = ?`)
    .get(chatId) as SilenceRow | undefined;
}

function upsertSettings(chatId: number, settings: SilenceSettings): void {
  ensureChat(chatId);
  const now = Date.now();

  getDb()
    .prepare(
      `INSERT INTO silence_settings (
         chat_id, enabled, until_ms, open_suffix, closed_suffix, duration_presets,
         schedule_enabled, schedule_start_minutes, schedule_end_minutes, schedule_timezone,
         schedule_weekends_enabled, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(chat_id) DO UPDATE SET
         enabled = excluded.enabled,
         until_ms = excluded.until_ms,
         open_suffix = excluded.open_suffix,
         closed_suffix = excluded.closed_suffix,
         duration_presets = excluded.duration_presets,
         schedule_enabled = excluded.schedule_enabled,
         schedule_start_minutes = excluded.schedule_start_minutes,
         schedule_end_minutes = excluded.schedule_end_minutes,
         schedule_timezone = excluded.schedule_timezone,
         schedule_weekends_enabled = excluded.schedule_weekends_enabled,
         updated_at = excluded.updated_at`,
    )
    .run(
      chatId,
      settings.enabled ? 1 : 0,
      settings.untilMs,
      settings.openSuffix,
      settings.closedSuffix,
      JSON.stringify(settings.durationPresets),
      settings.scheduleEnabled ? 1 : 0,
      settings.scheduleStartMinutes,
      settings.scheduleEndMinutes,
      settings.scheduleTimezone,
      settings.scheduleWeekendsEnabled ? 1 : 0,
      now,
    );
}

export function getSilenceSettings(chatId: number): SilenceSettings {
  return rowToSettings(getRow(chatId));
}

export function listScheduledChatIds(): number[] {
  const rows = getDb()
    .prepare('SELECT chat_id FROM silence_settings WHERE schedule_enabled = 1')
    .all() as { chat_id: number }[];

  return rows.map((row) => row.chat_id);
}

export function getSilence(chatId: number): Pick<SilenceSettings, 'enabled' | 'untilMs'> {
  const settings = getSilenceSettings(chatId);
  return {
    enabled: settings.enabled,
    untilMs: settings.untilMs,
  };
}

export function setSilence(
  chatId: number,
  enabled: boolean,
  untilMs: number | null,
): void {
  const current = getSilenceSettings(chatId);
  upsertSettings(chatId, { ...current, enabled, untilMs });
}

export function disableSilence(chatId: number): void {
  setSilence(chatId, false, null);
}

export function updateSilenceMessages(
  chatId: number,
  input: { openSuffix?: string | null; closedSuffix?: string | null },
): SilenceSettings {
  const current = getSilenceSettings(chatId);

  const openSuffix =
    input.openSuffix === undefined
      ? current.openSuffix
      : normalizeSuffix(input.openSuffix);
  const closedSuffix =
    input.closedSuffix === undefined
      ? current.closedSuffix
      : normalizeSuffix(input.closedSuffix);

  const next = { ...current, openSuffix, closedSuffix };
  upsertSettings(chatId, next);
  return next;
}

export function updateDurationPresets(
  chatId: number,
  presets: SilenceDurationPreset[],
): SilenceSettings {
  const current = getSilenceSettings(chatId);
  const next = {
    ...current,
    durationPresets: normalizeDurationPresets(presets),
  };
  upsertSettings(chatId, next);
  return next;
}

export function updateSilenceSchedule(
  chatId: number,
  input: {
    enabled?: boolean;
    startMinutes?: number;
    endMinutes?: number;
    timezone?: string | null;
    weekendsEnabled?: boolean;
  },
): SilenceSettings {
  const current = getSilenceSettings(chatId);
  const enablingSchedule = input.enabled === true && !current.scheduleEnabled;

  if (enablingSchedule && isManualSilenceEnabled(current)) {
    throw new Error('SCHEDULE_BLOCKED_BY_MANUAL');
  }

  const next: SilenceSettings = {
    ...current,
    scheduleEnabled: input.enabled !== undefined ? input.enabled : current.scheduleEnabled,
    scheduleStartMinutes: input.startMinutes ?? current.scheduleStartMinutes,
    scheduleEndMinutes: input.endMinutes ?? current.scheduleEndMinutes,
    scheduleTimezone:
      input.timezone === undefined ? current.scheduleTimezone : input.timezone,
    scheduleWeekendsEnabled:
      input.weekendsEnabled !== undefined
        ? input.weekendsEnabled
        : current.scheduleWeekendsEnabled,
  };

  upsertSettings(chatId, next);
  return next;
}

function isManualSilenceEnabled(settings: SilenceSettings): boolean {
  if (!settings.enabled) return false;
  if (settings.untilMs === null) return true;
  return Date.now() < settings.untilMs;
}

export function getResolvedSchedule(settings: SilenceSettings) {
  return {
    enabled: settings.scheduleEnabled,
    startMinutes: settings.scheduleStartMinutes,
    endMinutes: settings.scheduleEndMinutes,
    timezone: getTimezoneOrDefault(settings.scheduleTimezone),
    weekendsEnabled: settings.scheduleWeekendsEnabled,
  };
}

export function getScheduleLastInWindow(chatId: number): boolean | null {
  const row = getDb()
    .prepare('SELECT schedule_last_in_window FROM silence_settings WHERE chat_id = ?')
    .get(chatId) as { schedule_last_in_window: number | null } | undefined;

  if (!row || row.schedule_last_in_window === null) return null;
  return row.schedule_last_in_window === 1;
}

export function setScheduleLastInWindow(chatId: number, value: boolean | null): void {
  ensureChat(chatId);
  const current = getSilenceSettings(chatId);
  upsertSettings(chatId, current);

  getDb()
    .prepare(
      `UPDATE silence_settings
       SET schedule_last_in_window = ?, updated_at = ?
       WHERE chat_id = ?`,
    )
    .run(value === null ? null : value ? 1 : 0, Date.now(), chatId);
}

export function getStatusMessageId(chatId: number): string | null {
  const row = getDb()
    .prepare('SELECT status_message_id FROM silence_settings WHERE chat_id = ?')
    .get(chatId) as { status_message_id: string | null } | undefined;

  return row?.status_message_id ?? null;
}

export function setStatusMessageId(chatId: number, messageId: string | null): void {
  ensureChat(chatId);
  const current = getSilenceSettings(chatId);
  upsertSettings(chatId, current);

  getDb()
    .prepare(
      `UPDATE silence_settings
       SET status_message_id = ?, updated_at = ?
       WHERE chat_id = ?`,
    )
    .run(messageId, Date.now(), chatId);
}

function normalizeSuffix(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
