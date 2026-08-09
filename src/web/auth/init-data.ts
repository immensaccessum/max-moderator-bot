import crypto from 'node:crypto';
import { config } from '../../config.js';

export type MaxWebAppUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string | null;
  language_code?: string;
  photo_url?: string;
};

export type MaxInitData = {
  query_id?: string;
  auth_date: number;
  hash: string;
  user?: MaxWebAppUser;
  chat?: {
    id: number;
    type: 'DIALOG' | 'CHAT' | 'CHANNEL';
  };
  start_param?: string;
};

type ParsedPair = {
  key: string;
  rawValue: string;
  decodedValue: string;
};

function parseInitDataPairs(initData: string): ParsedPair[] {
  return initData.split('&').flatMap((part) => {
    const eq = part.indexOf('=');
    if (eq === -1) return [];
    const key = part.slice(0, eq);
    const rawValue = part.slice(eq + 1);
    let decodedValue = rawValue;
    try {
      decodedValue = decodeURIComponent(rawValue.replace(/\+/g, '%20'));
    } catch {
      decodedValue = rawValue;
    }
    return [{ key, rawValue, decodedValue }];
  });
}

function buildDataCheckString(pairs: ParsedPair[]): string {
  return pairs
    .filter((pair) => pair.key !== 'hash')
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((pair) => `${pair.key}=${pair.decodedValue}`)
    .join('\n');
}

export function validateInitData(initData: string, botToken = config.botToken): boolean {
  const pairs = parseInitDataPairs(initData);
  const hashPair = pairs.find((pair) => pair.key === 'hash');
  if (!hashPair?.decodedValue) return false;

  const dataCheckString = buildDataCheckString(pairs);
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expectedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  return expectedHash === hashPair.decodedValue;
}

export function parseInitData(initData: string, botToken = config.botToken): MaxInitData | null {
  if (!validateInitData(initData, botToken)) return null;

  const pairs = parseInitDataPairs(initData);
  const values = new Map(pairs.map((pair) => [pair.key, pair.decodedValue]));

  const authDate = Number(values.get('auth_date'));
  if (!Number.isFinite(authDate)) return null;

  const maxAgeSec = config.web.initDataMaxAgeSec;
  if (maxAgeSec > 0 && Date.now() / 1000 - authDate > maxAgeSec) {
    return null;
  }

  let user: MaxWebAppUser | undefined;
  const userRaw = values.get('user');
  if (userRaw) {
    try {
      user = JSON.parse(userRaw) as MaxWebAppUser;
    } catch {
      return null;
    }
    if (!user?.id) return null;
  }

  let chat: MaxInitData['chat'];
  const chatRaw = values.get('chat');
  if (chatRaw) {
    try {
      chat = JSON.parse(chatRaw) as MaxInitData['chat'];
    } catch {
      chat = undefined;
    }
  }

  return {
    query_id: values.get('query_id'),
    auth_date: authDate,
    hash: values.get('hash') ?? '',
    user,
    chat,
    start_param: values.get('start_param'),
  };
}
