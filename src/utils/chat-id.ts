/**
 * Max group chat IDs are negative integers (e.g. -69724580932251).
 */
export function parseChatId(raw: string | string[]): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const chatId = Number(value);
  if (!Number.isSafeInteger(chatId) || chatId === 0) {
    return null;
  }
  return chatId;
}
