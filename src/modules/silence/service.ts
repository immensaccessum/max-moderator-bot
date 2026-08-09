import type { Bot } from '@maxhub/max-bot-api';
import { deleteAndRecord } from '../deletion-log/service.js';
import {
  SILENCE_DURATION_LABELS,
  SILENCE_DURATIONS,
  type SilenceDurationKey,
} from './constants.js';
import {
  formatMinutesAsTime,
  formatScheduleDescription,
  formatScheduleRange,
  isWeekendInTimezone,
  isWithinSchedule,
  getTimezoneOrDefault,
} from './schedule.js';
import {
  disableSilence,
  getResolvedSchedule,
  getSilenceSettings,
  getStatusMessageId,
  setSilence,
  setStatusMessageId,
} from './store.js';

export function isManualSilenceActive(chatId: number): boolean {
  if (isScheduleSilenceActive(chatId)) return false;

  const state = getSilenceSettings(chatId);
  if (!state.enabled) return false;

  if (state.untilMs === null) return true;

  if (Date.now() >= state.untilMs) {
    disableSilence(chatId);
    return false;
  }

  return true;
}

export function isWeekendScheduleSilenceActive(chatId: number, date = new Date()): boolean {
  const settings = getSilenceSettings(chatId);
  if (!settings.scheduleEnabled || !settings.scheduleWeekendsEnabled) return false;
  return isWeekendInTimezone(getTimezoneOrDefault(settings.scheduleTimezone), date);
}

export function isScheduleSilenceActive(chatId: number, date = new Date()): boolean {
  const settings = getSilenceSettings(chatId);
  if (!settings.scheduleEnabled) return false;
  return isWithinSchedule(getResolvedSchedule(settings), date);
}

/** Ручная тишина недоступна, пока чат уже закрыт по расписанию. */
export function isManualSilenceBlocked(chatId: number): boolean {
  if (isManualSilenceActive(chatId)) return false;
  return isScheduleSilenceActive(chatId);
}

/** Включить расписание нельзя, пока активна ручная тишина. */
export function isScheduleBlocked(chatId: number): boolean {
  if (getSilenceSettings(chatId).scheduleEnabled) return false;
  return isManualSilenceActive(chatId);
}

export function isSilenceActive(chatId: number, date = new Date()): boolean {
  if (isScheduleSilenceActive(chatId, date)) return true;
  return isManualSilenceActive(chatId);
}

function assertManualActivationAllowed(chatId: number): void {
  if (isManualSilenceActive(chatId)) return;
  if (isSilenceActive(chatId)) {
    throw new Error('SILENCE_ALREADY_ACTIVE');
  }
}

export function enableSilence(chatId: number, key: SilenceDurationKey): void {
  assertManualActivationAllowed(chatId);
  const durationMs = SILENCE_DURATIONS[key];
  const untilMs = durationMs === null ? null : Date.now() + durationMs;
  setSilence(chatId, true, untilMs);
}

export function enableSilenceForMinutes(chatId: number, minutes: number): void {
  assertManualActivationAllowed(chatId);
  const untilMs = Date.now() + minutes * 60 * 1000;
  setSilence(chatId, true, untilMs);
}

export function enableSilenceForever(chatId: number): void {
  assertManualActivationAllowed(chatId);
  setSilence(chatId, true, null);
}

export function turnOffSilence(chatId: number): void {
  disableSilence(chatId);
}

/** Сбрасывает ручную тишину, когда вступает в силу расписание. */
export function releaseManualSilenceForSchedule(chatId: number): void {
  const settings = getSilenceSettings(chatId);
  if (!settings.enabled) return;
  if (settings.untilMs !== null && Date.now() >= settings.untilMs) return;
  disableSilence(chatId);
}

export function formatSilenceStatus(chatId: number): string {
  const settings = getSilenceSettings(chatId);
  const lines: string[] = [];
  const manualActive = isManualSilenceActive(chatId);
  const scheduleActive = isScheduleSilenceActive(chatId);

  if (settings.scheduleEnabled) {
    const description = formatScheduleDescription(
      settings.scheduleStartMinutes,
      settings.scheduleEndMinutes,
      settings.scheduleWeekendsEnabled,
    );
    const timezone = getResolvedSchedule(settings).timezone;
    lines.push(
      `📅 Расписание: ${description} (${timezone}) — ${scheduleActive ? 'сейчас закрыт' : 'сейчас открыт'}`,
    );
  } else {
    lines.push('📅 Расписание: выключено');
  }

  if (manualActive) {
    if (settings.untilMs === null) {
      lines.push('🔇 Ручная тишина: постоянно');
    } else {
      const until = new Date(settings.untilMs).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      lines.push(`🔇 Ручная тишина: до ${until}`);
    }
  } else {
    lines.push('🔇 Ручная тишина: выключена');
  }

  lines.push(isSilenceActive(chatId) ? '🔒 Чат сейчас закрыт' : '✅ Чат сейчас открыт');

  return lines.join('\n');
}

export function formatDurationLabel(key: SilenceDurationKey): string {
  return SILENCE_DURATION_LABELS[key];
}

export function buildChatStatusMessage(chatId: number): string {
  const settings = getSilenceSettings(chatId);
  const active = isSilenceActive(chatId);

  if (active) {
    let main: string;

    if (isScheduleSilenceActive(chatId)) {
      if (isWeekendScheduleSilenceActive(chatId)) {
        main = '🔒 Чат закрыт — выходной';
      } else {
        const range = formatScheduleRange(
          settings.scheduleStartMinutes,
          settings.scheduleEndMinutes,
        );
        main = `🔒 Чат закрыт по расписанию (${range})`;
      }
    } else if (isManualSilenceActive(chatId)) {
      if (settings.untilMs === null) {
        main = '🔒 Чат закрыт — режим тишины включён постоянно';
      } else {
        const until = new Date(settings.untilMs).toLocaleString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
        main = `🔒 Чат закрыт — режим тишины до ${until}`;
      }
    } else {
      main = '🔒 Чат закрыт — режим тишины включён';
    }

    if (settings.closedSuffix) {
      main += `\n\n${settings.closedSuffix}`;
    }

    return main;
  }

  let main = '✅ Чат открыт — можно писать';

  if (settings.openSuffix) {
    main += `\n\n${settings.openSuffix}`;
  }

  return main;
}

export async function announceChatStatus(bot: Bot, chatId: number): Promise<void> {
  const previousMessageId = getStatusMessageId(chatId);

  if (previousMessageId) {
    await deleteAndRecord(
      () => bot.api.deleteMessage(previousMessageId),
      {
        chatId,
        messageId: previousMessageId,
        source: 'silence_status',
        sourceDetail: 'Предыдущее статусное сообщение тишины',
        eventType: 'system',
        messageText: 'Статусное сообщение «чат открыт / закрыт»',
      },
    );
  }

  const message = await bot.api.sendMessageToChat(chatId, buildChatStatusMessage(chatId));
  setStatusMessageId(chatId, message.body.mid);
}

export function formatScheduleStartLabel(chatId: number): string {
  const settings = getSilenceSettings(chatId);
  return `С ${formatMinutesAsTime(settings.scheduleStartMinutes)}`;
}

export function formatScheduleEndLabel(chatId: number): string {
  const settings = getSilenceSettings(chatId);
  return `До ${formatMinutesAsTime(settings.scheduleEndMinutes)}`;
}
