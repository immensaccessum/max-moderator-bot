import { ensureChat } from '../../db/chats.js';
import {
  DEFAULT_DURATION_PRESETS,
  getPresetLabel,
  normalizeDurationPresets,
  SILENCE_DURATION_LABELS,
  type SilenceDurationKey,
  type SilenceDurationPreset,
} from '../../modules/silence/constants.js';
import { formatScheduleRange, getTimezoneOrDefault } from '../../modules/silence/schedule.js';
import {
  enableSilence,
  enableSilenceForMinutes,
  enableSilenceForever,
  isManualSilenceBlocked,
  turnOffSilence,
} from '../../modules/silence/service.js';
import {
  updateDurationPresets,
  updateSilenceMessages,
  updateSilenceSchedule,
} from '../../modules/silence/store.js';
import { toChatDto, type ChatDto } from './chats.js';

function toPresetDto(preset: SilenceDurationPreset) {
  return {
    minutes: preset.minutes,
    label: getPresetLabel(preset),
  };
}

export function updateChatSilence(
  chatId: number,
  input:
    | { enabled: false }
    | { duration: SilenceDurationKey }
    | { minutes: number }
    | { forever: true },
): ChatDto | null {
  ensureChat(chatId);

  if ('enabled' in input && input.enabled === false) {
    turnOffSilence(chatId);
  } else {
    if (isManualSilenceBlocked(chatId)) {
      throw new Error('SILENCE_ALREADY_ACTIVE');
    }

    if ('duration' in input) {
      enableSilence(chatId, input.duration);
    } else if ('minutes' in input) {
      enableSilenceForMinutes(chatId, input.minutes);
    } else if ('forever' in input) {
      enableSilenceForever(chatId);
    }
  }

  return toChatDto(chatId);
}

export function updateChatSilenceConfig(
  chatId: number,
  input: {
    openSuffix?: string | null;
    closedSuffix?: string | null;
    durationPresets?: SilenceDurationPreset[];
    schedule?: {
      enabled?: boolean;
      startMinutes?: number;
      endMinutes?: number;
      timezone?: string | null;
      weekendsEnabled?: boolean;
    };
  },
): ChatDto | null {
  ensureChat(chatId);

  if (input.openSuffix !== undefined || input.closedSuffix !== undefined) {
    updateSilenceMessages(chatId, {
      openSuffix: input.openSuffix,
      closedSuffix: input.closedSuffix,
    });
  }

  if (input.durationPresets) {
    updateDurationPresets(chatId, input.durationPresets);
  }

  if (input.schedule) {
    updateSilenceSchedule(chatId, input.schedule);
  }

  return toChatDto(chatId);
}

export function getSilenceMeta() {
  return {
    durations: Object.entries(SILENCE_DURATION_LABELS).map(([key, label]) => ({
      key,
      label,
    })),
    defaultPresets: DEFAULT_DURATION_PRESETS.map(toPresetDto),
    maxPresetMinutes: 60 * 24 * 30,
    defaultTimezone: getTimezoneOrDefault(null),
    timezones: [
      'Europe/Kaliningrad',
      'Europe/Moscow',
      'Europe/Samara',
      'Asia/Yekaterinburg',
      'Asia/Omsk',
      'Asia/Krasnoyarsk',
      'Asia/Irkutsk',
      'Asia/Yakutsk',
      'Asia/Vladivostok',
      'Asia/Magadan',
      'Asia/Kamchatka',
    ],
    defaultSchedule: {
      startMinutes: 21 * 60,
      endMinutes: 9 * 60,
      label: formatScheduleRange(21 * 60, 9 * 60),
    },
  };
}

export function parseDurationPresetsInput(
  presets: SilenceDurationPreset[],
): SilenceDurationPreset[] {
  return normalizeDurationPresets(presets);
}
