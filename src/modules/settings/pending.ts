export type PendingInput =
  | { type: 'duration'; chatId: number }
  | { type: 'openSuffix'; chatId: number }
  | { type: 'closedSuffix'; chatId: number }
  | { type: 'scheduleStart'; chatId: number }
  | { type: 'scheduleEnd'; chatId: number };

type PendingEntry = {
  input: PendingInput;
  expiresAt: number;
};

const PENDING_TTL_MS = 10 * 60_000;
const pendingByUser = new Map<number, PendingEntry>();

function cleanupExpiredPending(): void {
  const now = Date.now();
  for (const [userId, entry] of pendingByUser) {
    if (entry.expiresAt <= now) {
      pendingByUser.delete(userId);
    }
  }
}

export function setPendingInput(userId: number, input: PendingInput): void {
  cleanupExpiredPending();
  pendingByUser.set(userId, {
    input,
    expiresAt: Date.now() + PENDING_TTL_MS,
  });
}

export function takePendingInput(userId: number): PendingInput | undefined {
  cleanupExpiredPending();
  const entry = pendingByUser.get(userId);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    pendingByUser.delete(userId);
    return undefined;
  }
  pendingByUser.delete(userId);
  return entry.input;
}

export function clearPendingInput(userId: number): void {
  pendingByUser.delete(userId);
}

export function getPendingPrompt(input: PendingInput): string {
  switch (input.type) {
    case 'duration':
      return (
        'Введите длительность тишины.\n' +
        'Примеры: 45, 90m, 2h, 1d или «постоянно».\n' +
        'Отправьте «-» чтобы отменить.'
      );
    case 'openSuffix':
      return (
        'Введите приписку к сообщению «чат открыт».\n' +
        'Отправьте «-» чтобы очистить, или «отмена».'
      );
    case 'closedSuffix':
      return (
        'Введите приписку к сообщению «чат закрыт».\n' +
        'Отправьте «-» чтобы очистить, или «отмена».'
      );
    case 'scheduleStart':
      return (
        'Введите время начала тишины по расписанию.\n' +
        'Формат: 21:00 или 9:00.\n' +
        'Отправьте «-» чтобы отменить.'
      );
    case 'scheduleEnd':
      return (
        'Введите время окончания тишины по расписанию.\n' +
        'Формат: 09:00 или 9:00.\n' +
        'Отправьте «-» чтобы отменить.'
      );
  }
}
