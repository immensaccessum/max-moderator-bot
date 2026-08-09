import type { TriggerMatchType } from './types.js';

const MAX_REGEX_LENGTH = 500;

function normalize(value: string, caseSensitive: boolean): string {
  const nfkc = value.normalize('NFKC');
  return caseSensitive ? nfkc : nfkc.toLowerCase();
}

export function compileTriggerRegex(pattern: string, caseSensitive: boolean): RegExp {
  const flags = caseSensitive ? 'u' : 'iu';
  return new RegExp(pattern, flags);
}

export function validateRegexPattern(pattern: string, caseSensitive: boolean): void {
  const trimmed = pattern.trim();
  if (!trimmed) {
    throw new Error('INVALID_REGEX');
  }
  if (trimmed.length > MAX_REGEX_LENGTH) {
    throw new Error('INVALID_REGEX');
  }

  try {
    compileTriggerRegex(trimmed, caseSensitive);
  } catch {
    throw new Error('INVALID_REGEX');
  }
}

export function matchesTrigger(
  messageText: string,
  keyPhrase: string,
  matchType: TriggerMatchType,
  caseSensitive: boolean,
): boolean {
  const trimmedMessage = messageText.trim();
  const trimmedKey = keyPhrase.trim();

  if (!trimmedMessage || !trimmedKey) return false;

  if (matchType === 'regex') {
    try {
      const regex = compileTriggerRegex(trimmedKey, caseSensitive);
      return regex.test(trimmedMessage.normalize('NFKC'));
    } catch {
      return false;
    }
  }

  const haystack = normalize(trimmedMessage, caseSensitive);
  const needle = normalize(trimmedKey, caseSensitive);

  if (matchType === 'exact') {
    return haystack === needle;
  }

  return haystack.includes(needle);
}
