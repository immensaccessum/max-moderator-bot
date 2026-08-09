import type { Bot } from '@maxhub/max-bot-api';
import { ensureChat, getChat, listChats } from '../../db/chats.js';
import { createLogger } from '../../utils/logger.js';
import { getPresetLabel } from '../../modules/silence/constants.js';
import { formatMinutesAsTime } from '../../modules/silence/schedule.js';
import {
  isManualSilenceBlocked,
  isScheduleBlocked,
  isScheduleSilenceActive,
  isSilenceActive,
} from '../../modules/silence/service.js';
import { getSilenceSettings, getResolvedSchedule } from '../../modules/silence/store.js';

const log = createLogger('web');

export type ChatSilenceDto = {
  enabled: boolean;
  active: boolean;
  untilMs: number | null;
  until: string | null;
  openSuffix: string | null;
  closedSuffix: string | null;
  durationPresets: Array<{ minutes: number | null; label: string }>;
  schedule: {
    enabled: boolean;
    active: boolean;
    startMinutes: number;
    endMinutes: number;
    start: string;
    end: string;
    timezone: string;
    weekendsEnabled: boolean;
    blocked: boolean;
  };
  manualBlocked: boolean;
};

export type ChatDto = {
  id: number;
  title: string | null;
  silence: ChatSilenceDto;
  updatedAt: number;
};

function toPresetDto(preset: { minutes: number | null; label?: string }) {
  return {
    minutes: preset.minutes,
    label: getPresetLabel(preset),
  };
}

export function toChatDto(chatId: number): ChatDto | null {
  const chat = getChat(chatId);
  if (!chat) return null;

  const settings = getSilenceSettings(chatId);
  const active = isSilenceActive(chatId);
  const schedule = getResolvedSchedule(settings);

  return {
    id: chat.chatId,
    title: chat.title,
    silence: {
      enabled: settings.enabled,
      active,
      untilMs: settings.untilMs,
      until: settings.untilMs ? new Date(settings.untilMs).toISOString() : null,
      openSuffix: settings.openSuffix,
      closedSuffix: settings.closedSuffix,
      durationPresets: settings.durationPresets.map(toPresetDto),
      schedule: {
        enabled: settings.scheduleEnabled,
        active: isScheduleSilenceActive(chatId),
        startMinutes: settings.scheduleStartMinutes,
        endMinutes: settings.scheduleEndMinutes,
        start: formatMinutesAsTime(settings.scheduleStartMinutes),
        end: formatMinutesAsTime(settings.scheduleEndMinutes),
        timezone: schedule.timezone,
        weekendsEnabled: settings.scheduleWeekendsEnabled,
        blocked: isScheduleBlocked(chatId),
      },
      manualBlocked: isManualSilenceBlocked(chatId),
    },
    updatedAt: chat.updatedAt,
  };
}

export function listChatDtos(): ChatDto[] {
  return listChats()
    .map((chat) => toChatDto(chat.chatId))
    .filter((chat): chat is ChatDto => chat !== null);
}

export async function listChatDtosForUser(bot: Bot, userId: number): Promise<ChatDto[]> {
  const all = listChatDtos();
  const allowed: ChatDto[] = [];

  for (const chat of all) {
    try {
      const info = await bot.api.getChat(chat.id);
      if (info.type !== 'chat') {
        continue;
      }

      const { members } = await bot.api.getChatMembers(chat.id, {
        user_ids: [userId],
      });
      const member = members[0];
      if (member?.is_admin || member?.is_owner) {
        allowed.push(chat);
      }
    } catch (err) {
      log.warn('skip chat in user list', { chatId: chat.id, userId, err });
    }
  }

  return allowed;
}

export async function syncChatsFromBot(bot: Bot): Promise<{ synced: number }> {
  let synced = 0;
  let marker: number | null = null;

  do {
    const response = await bot.api.getAllChats(marker ? { marker } : {});
    for (const chat of response.chats) {
      if (chat.type === 'chat' && chat.status === 'active') {
        ensureChat(chat.chat_id, chat.title);
        synced += 1;
      }
    }
    marker = response.marker;
  } while (marker);

  return { synced };
}
