import { listDeletionLogs } from '../../modules/deletion-log/store.js';
import type { DeletionLogDto } from '../../modules/deletion-log/types.js';

export function listChatDeletionLogs(chatId: number): DeletionLogDto[] {
  return listDeletionLogs(chatId);
}
