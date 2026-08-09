import {
  createAutopost,
  deleteAutopost,
  listAutoposts,
  updateAutopost,
} from '../../modules/autopost/store.js';
import { AUTOPOST_MAX_MESSAGE_LENGTH } from '../../modules/autopost/constants.js';
import type { AutopostDto, AutopostScheduleType } from '../../modules/autopost/types.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('api');

export function mapAutopostError(err: unknown): { status: number; message: string } | null {
  const message = err instanceof Error ? err.message : String(err);
  if (message === 'MESSAGE_REQUIRED') {
    return { status: 400, message: 'Введите текст сообщения' };
  }
  if (message === 'MESSAGE_TOO_LONG') {
    return {
      status: 400,
      message: `Текст сообщения не длиннее ${AUTOPOST_MAX_MESSAGE_LENGTH} символов`,
    };
  }
  if (message === 'INVALID_INTERVAL') {
    return { status: 400, message: 'Интервал: от 5 минут до 7 суток' };
  }
  if (message === 'INVALID_TIME') {
    return { status: 400, message: 'Укажите корректное время' };
  }
  if (message === 'INVALID_WEEKDAY') {
    return { status: 400, message: 'Укажите день недели' };
  }
  return null;
}

export function listChatAutoposts(chatId: number): AutopostDto[] {
  return listAutoposts(chatId);
}

export function createChatAutopost(
  input: {
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
  },
  actorUserId?: number,
): AutopostDto {
  const autopost = createAutopost(input);
  log.info('autopost created', {
    autopostId: autopost.id,
    chatId: input.chatId,
    userId: actorUserId,
    scheduleType: autopost.scheduleType,
    enabled: autopost.enabled,
  });
  return autopost;
}

export function updateChatAutopost(
  autopostId: number,
  chatId: number,
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
  actorUserId?: number,
): AutopostDto | null {
  const existing = listAutoposts(chatId).find((item) => item.id === autopostId);
  if (!existing) {
    return null;
  }

  const autopost = updateAutopost(autopostId, input);
  log.info('autopost updated', {
    autopostId,
    chatId,
    userId: actorUserId,
    fields: Object.keys(input),
  });
  return autopost;
}

export function deleteChatAutopost(
  autopostId: number,
  chatId: number,
  actorUserId?: number,
): boolean {
  const existing = listAutoposts(chatId).find((item) => item.id === autopostId);
  if (!existing) {
    return false;
  }

  deleteAutopost(autopostId);
  log.info('autopost deleted', {
    autopostId,
    chatId,
    userId: actorUserId,
  });
  return true;
}
