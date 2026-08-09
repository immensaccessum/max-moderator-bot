import { createLogger } from '../../utils/logger.js';
import { recordDeletion } from './store.js';
import type { DeletionEventType, DeletionSource } from './types.js';

const log = createLogger('deletion-log');

export function formatSenderLabel(sender?: {
  user_id: number;
  name: string;
  username: string | null;
} | null): string | null {
  if (!sender) return null;
  if (sender.username) return `@${sender.username}`;
  return sender.name || `ID ${sender.user_id}`;
}

export type DeletionLogInput = {
  chatId: number;
  messageId?: string | null;
  userId?: number | null;
  userLabel?: string | null;
  messageText?: string | null;
  source: DeletionSource;
  sourceDetail?: string | null;
  eventType?: DeletionEventType;
};

export async function deleteAndRecord(
  deleteFn: () => Promise<unknown>,
  input: DeletionLogInput,
): Promise<boolean> {
  try {
    await deleteFn();
    recordDeletion({ ...input, success: true });
    log.info('message deleted', {
      chatId: input.chatId,
      source: input.source,
      messageId: input.messageId,
      userId: input.userId,
    });
    return true;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    recordDeletion({ ...input, success: false, errorMessage });
    log.error('message delete failed', {
      err,
      chatId: input.chatId,
      source: input.source,
      messageId: input.messageId,
    });
    return false;
  }
}
