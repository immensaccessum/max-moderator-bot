import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parseInitData, validateInitData } from './init-data.js';

const BOT_TOKEN = 'test-bot-token';

function buildInitData(userId: number, authDate = Math.floor(Date.now() / 1000)): string {
  const user = JSON.stringify({ id: userId, name: 'Test User', username: null, is_bot: false });
  const pairs = [
    ['auth_date', String(authDate)],
    ['user', user],
  ];

  const dataCheckString = pairs
    .map(([key, value]) => `${key}=${value}`)
    .sort((a, b) => a.localeCompare(b))
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  return `auth_date=${authDate}&user=${encodeURIComponent(user)}&hash=${hash}`;
}

describe('init-data auth', () => {
  it('validates and parses signed init data', () => {
    const initData = buildInitData(42);
    expect(validateInitData(initData, BOT_TOKEN)).toBe(true);

    const parsed = parseInitData(initData, BOT_TOKEN);
    expect(parsed?.user?.id).toBe(42);
    expect(parsed?.auth_date).toBeGreaterThan(0);
  });

  it('rejects tampered hash', () => {
    const initData = `${buildInitData(42)}&extra=1`;
    expect(validateInitData(initData, BOT_TOKEN)).toBe(false);
  });
});
