import { Keyboard } from '@maxhub/max-bot-api';
import type { Chat } from '@maxhub/max-bot-api/types';
import type { InlineKeyboardAttachmentRequest } from '@maxhub/max-bot-api/types';
import type { Button } from '@maxhub/max-bot-api/types';
import { config } from '../../config.js';
import {
  formatSilenceStatus,
  formatScheduleEndLabel,
  formatScheduleStartLabel,
  isManualSilenceActive,
  isManualSilenceBlocked,
  isScheduleBlocked,
} from '../silence/service.js';
import { getPresetLabel } from '../silence/constants.js';
import { getSilenceSettings } from '../silence/store.js';

const { inlineKeyboard, button } = Keyboard;

function formatSuffixPreview(value: string | null): string {
  if (!value) return '—';
  const preview = value.length > 60 ? `${value.slice(0, 57)}...` : value;
  return preview.replace(/\n/g, ' ');
}

export function buildSettingsText(chatId: number, chatTitle?: string | null): string {
  const header = chatTitle ? `⚙️ «${chatTitle}»` : `⚙️ Чат ${chatId}`;
  const settings = getSilenceSettings(chatId);

  let modeHint =
    'Ручную тишину можно включить, пока чат открыт. Расписание — пока не активна ручная тишина.';
  if (isManualSilenceBlocked(chatId)) {
    modeHint = 'Сейчас чат закрыт по расписанию. Ручную тишину включить нельзя.';
  } else if (isManualSilenceActive(chatId)) {
    modeHint = 'Активна ручная тишина. Сначала выключите её, чтобы включить расписание.';
  }

  return (
    `${header}\n\n` +
    `${formatSilenceStatus(chatId)}\n\n` +
    `${modeHint}\n\n` +
    `📝 Приписка «открыт»: ${formatSuffixPreview(settings.openSuffix)}\n` +
    `📝 Приписка «закрыт»: ${formatSuffixPreview(settings.closedSuffix)}\n\n` +
    'Админы могут писать в режиме тишины. Остальные сообщения удаляются.'
  );
}

function appendManualSilenceRows(rows: Button[][], targetChatId: number): void {
  const id = String(targetChatId);
  const settings = getSilenceSettings(targetChatId);

  if (isManualSilenceActive(targetChatId)) {
    rows.push([button.callback('✅ Выключить ручную тишину', `silence:off:${id}`)]);
    return;
  }

  if (isManualSilenceBlocked(targetChatId)) return;

  for (const preset of settings.durationPresets) {
    if (preset.minutes === null) {
      rows.push([button.callback(`♾ ${getPresetLabel(preset)}`, `silence:forever:${id}`)]);
      continue;
    }

    rows.push([
      button.callback(`⏱ ${getPresetLabel(preset)}`, `silence:mins:${preset.minutes}:${id}`),
    ]);
  }

  rows.push([button.callback('✏️ Своё время', `silence:custom:${id}`)]);
}

export function buildSettingsKeyboard(targetChatId: number): InlineKeyboardAttachmentRequest {
  const id = String(targetChatId);
  const settings = getSilenceSettings(targetChatId);
  const rows: Button[][] = [];

  if (settings.scheduleEnabled) {
    rows.push([button.callback('📅 Расписание: вкл', `schedule:toggle:${id}`)]);
    rows.push([
      button.callback(formatScheduleStartLabel(targetChatId), `schedule:start:${id}`),
      button.callback(formatScheduleEndLabel(targetChatId), `schedule:end:${id}`),
    ]);
    rows.push([
      button.callback(
        settings.scheduleWeekendsEnabled ? '📆 Выходные: вкл' : '📆 Выходные: выкл',
        `schedule:weekends:${id}`,
      ),
    ]);
  } else if (!isScheduleBlocked(targetChatId)) {
    rows.push([button.callback('📅 Включить расписание', `schedule:toggle:${id}`)]);
  }

  appendManualSilenceRows(rows, targetChatId);

  rows.push([
    button.callback('📝 Приписка «открыт»', `silence:edit:open:${id}`),
    button.callback('📝 Приписка «закрыт»', `silence:edit:closed:${id}`),
  ]);
  rows.push([button.callback('🔄 Обновить', `settings:refresh:${id}`)]);
  if (config.web.publicUrl) {
    rows.push([button.link('🌐 Веб-админка', config.web.publicUrl)]);
  }
  rows.push([button.callback('◀️ К списку чатов', 'settings:list')]);

  return inlineKeyboard(rows);
}

export function buildChatPickerText(): string {
  return 'Выберите чат для настройки:';
}

export function buildChatPickerKeyboard(chats: Chat[]): InlineKeyboardAttachmentRequest {
  const rows: Button[][] = chats.map((chat) => [
    button.callback(
      chat.title ?? `Чат ${chat.chat_id}`,
      `settings:chat:${chat.chat_id}`,
    ),
  ]);

  if (config.web.publicUrl) {
    rows.push([button.link('🌐 Веб-админка', config.web.publicUrl)]);
  }

  return inlineKeyboard(rows);
}
