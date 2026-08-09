import {
  createTrigger,
  deleteTrigger,
  getTrigger,
  listTriggers,
  updateTrigger,
} from '../../modules/triggers/store.js';
import type { TriggerAction, TriggerDto, TriggerMatchType } from '../../modules/triggers/types.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('api');

export function mapTriggerError(err: unknown): { status: number; message: string } | null {
  const message = err instanceof Error ? err.message : String(err);
  if (message === 'KEY_REQUIRED') {
    return { status: 400, message: 'Укажите ключевую фразу' };
  }
  if (message === 'RESPONSE_REQUIRED') {
    return { status: 400, message: 'Укажите текст ответа для этого действия' };
  }
  if (message === 'INVALID_REGEX') {
    return { status: 400, message: 'Некорректное регулярное выражение' };
  }
  return null;
}

export function listChatTriggers(chatId: number): TriggerDto[] {
  return listTriggers(chatId);
}

export function createChatTrigger(
  input: {
    chatId: number;
    keyPhrase: string;
    responseText?: string;
    matchType?: TriggerMatchType;
    action?: TriggerAction;
    caseSensitive?: boolean;
    enabled?: boolean;
    autoDeleteReply?: boolean;
  },
  actorUserId?: number,
): TriggerDto {
  const trigger = createTrigger(input);
  log.info('trigger created', {
    triggerId: trigger.id,
    chatId: input.chatId,
    userId: actorUserId,
    matchType: trigger.matchType,
    action: trigger.action,
    enabled: trigger.enabled,
  });
  return trigger;
}

export function updateChatTrigger(
  triggerId: number,
  chatId: number,
  input: {
    keyPhrase?: string;
    responseText?: string;
    matchType?: TriggerMatchType;
    action?: TriggerAction;
    caseSensitive?: boolean;
    enabled?: boolean;
    autoDeleteReply?: boolean;
  },
  actorUserId?: number,
): TriggerDto | null {
  const existing = getTrigger(triggerId);
  if (!existing || existing.chatId !== chatId) {
    return null;
  }

  const trigger = updateTrigger(triggerId, input);
  log.info('trigger updated', {
    triggerId,
    chatId,
    userId: actorUserId,
    fields: Object.keys(input),
  });
  return trigger;
}

export function deleteChatTrigger(
  triggerId: number,
  chatId: number,
  actorUserId?: number,
): boolean {
  const existing = getTrigger(triggerId);
  if (!existing || existing.chatId !== chatId) {
    return false;
  }

  deleteTrigger(triggerId);
  log.info('trigger deleted', {
    triggerId,
    chatId,
    userId: actorUserId,
  });
  return true;
}
