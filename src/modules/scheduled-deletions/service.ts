import type { Api } from '@maxhub/max-bot-api';
import { createLogger } from '../../utils/logger.js';
import { recordDeletion } from '../deletion-log/store.js';
import type { DeletionSource } from '../deletion-log/types.js';
import { deleteScheduledDeletion, insertScheduledDeletion } from './store.js';
import { DEFAULT_AUTO_DELETE_MS, type ScheduleDeletionInput } from './types.js';

const log = createLogger('scheduled-deletions');

export function scheduleMessageDeletion(input: ScheduleDeletionInput): number {
  const delayMs = input.delayMs ?? DEFAULT_AUTO_DELETE_MS;
  const dueAt = Date.now() + delayMs;
  const id = insertScheduledDeletion({
    chatId: input.chatId,
    messageId: input.messageId,
    messageText: input.messageText,
    source: input.source,
    sourceDetail: input.sourceDetail,
    dueAt,
  });

  log.debug('deletion scheduled', {
    id,
    chatId: input.chatId,
    messageId: input.messageId,
    dueAt,
    source: input.source,
  });

  return id;
}

export async function executeScheduledDeletion(
  api: Api,
  row: {
    id: number;
    chat_id: number;
    message_id: string;
    message_text: string | null;
    source: string;
    source_detail: string | null;
  },
): Promise<void> {
  try {
    await api.deleteMessage(row.message_id);
    recordDeletion({
      chatId: row.chat_id,
      messageId: row.message_id,
      messageText: row.message_text,
      source: row.source as DeletionSource,
      sourceDetail: row.source_detail,
      eventType: 'system',
      success: true,
    });
    log.info('scheduled message deleted', {
      id: row.id,
      chatId: row.chat_id,
      messageId: row.message_id,
      source: row.source,
    });
  } catch (err) {
    recordDeletion({
      chatId: row.chat_id,
      messageId: row.message_id,
      messageText: row.message_text,
      source: row.source as DeletionSource,
      sourceDetail: row.source_detail,
      eventType: 'system',
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    log.error('scheduled message delete failed', {
      err,
      id: row.id,
      chatId: row.chat_id,
      messageId: row.message_id,
    });
  } finally {
    deleteScheduledDeletion(row.id);
  }
}
