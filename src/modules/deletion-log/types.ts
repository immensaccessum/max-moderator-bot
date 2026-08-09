export type DeletionSource = 'silence' | 'trigger' | 'settings' | 'silence_status' | 'ping';

export type DeletionEventType = 'message_created' | 'message_edited' | 'system';

export const DELETION_RETENTION_MS = 48 * 60 * 60 * 1000;

export const DELETION_SOURCE_LABELS: Record<DeletionSource, string> = {
  silence: 'Режим тишины',
  trigger: 'Триггер',
  settings: 'Команда /settings',
  silence_status: 'Служебное (статус тишины)',
  ping: 'Команда /ping',
};

export function normalizeDeletionSource(value: unknown): DeletionSource {
  if (
    value === 'silence' ||
    value === 'trigger' ||
    value === 'settings' ||
    value === 'silence_status' ||
    value === 'ping'
  ) {
    return value;
  }
  return 'silence';
}

export type DeletionLogRow = {
  id: number;
  chat_id: number;
  message_id: string | null;
  user_id: number | null;
  user_label: string | null;
  message_text: string | null;
  source: DeletionSource;
  source_detail: string | null;
  event_type: DeletionEventType;
  success: number;
  error_message: string | null;
  deleted_at: number;
};

export type DeletionLogDto = {
  id: number;
  chatId: number;
  messageId: string | null;
  userId: number | null;
  userLabel: string | null;
  messageText: string | null;
  source: DeletionSource;
  sourceLabel: string;
  sourceDetail: string | null;
  eventType: DeletionEventType;
  success: boolean;
  errorMessage: string | null;
  deletedAt: number;
  deleted: string;
};
