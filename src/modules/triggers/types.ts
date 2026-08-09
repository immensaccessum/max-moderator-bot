export type TriggerMatchType = 'exact' | 'contains' | 'regex';

export type TriggerAction = 'reply' | 'delete' | 'delete_reply';

export type TriggerRow = {
  id: number;
  chat_id: number;
  key_phrase: string;
  response_text: string;
  match_type: TriggerMatchType;
  action: TriggerAction | string;
  case_sensitive: number;
  enabled: number;
  auto_delete_reply: number;
  created_at: number;
  updated_at: number;
};

export type TriggerDto = {
  id: number;
  chatId: number;
  keyPhrase: string;
  responseText: string;
  matchType: TriggerMatchType;
  action: TriggerAction;
  actionLabel: string;
  caseSensitive: boolean;
  enabled: boolean;
  autoDeleteReply: boolean;
  createdAt: number;
  updatedAt: number;
};

export const TRIGGER_MATCH_LABELS: Record<TriggerMatchType, string> = {
  contains: 'Содержит фразу',
  exact: 'Точное совпадение',
  regex: 'Регулярное выражение',
};

export function normalizeTriggerMatchType(value: unknown): TriggerMatchType {
  if (value === 'exact' || value === 'contains' || value === 'regex') {
    return value;
  }
  return 'contains';
}

export const TRIGGER_ACTION_LABELS: Record<TriggerAction, string> = {
  reply: 'Ответить в чат',
  delete: 'Удалить сообщение',
  delete_reply: 'Удалить и ответить',
};

export function normalizeTriggerAction(value: unknown): TriggerAction {
  if (value === 'delete' || value === 'delete_reply' || value === 'reply') {
    return value;
  }
  return 'reply';
}

export function getTriggerActionLabel(action: TriggerAction): string {
  return TRIGGER_ACTION_LABELS[action];
}
