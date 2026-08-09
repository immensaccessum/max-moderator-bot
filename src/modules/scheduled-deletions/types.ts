import type { DeletionSource } from '../deletion-log/types.js';

export const DEFAULT_AUTO_DELETE_MS = 60_000;

export type ScheduledDeletionRow = {
  id: number;
  chat_id: number;
  message_id: string;
  message_text: string | null;
  source: string;
  source_detail: string | null;
  due_at: number;
  created_at: number;
};

export type ScheduleDeletionInput = {
  chatId: number;
  messageId: string;
  messageText?: string | null;
  source: DeletionSource;
  sourceDetail?: string | null;
  delayMs?: number;
};
