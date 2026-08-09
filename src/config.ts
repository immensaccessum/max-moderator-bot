import path from 'node:path';
import 'dotenv/config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

export const config = {
  botToken: requireEnv('BOT_TOKEN'),
  ownerId: process.env.OWNER_ID ? Number(process.env.OWNER_ID) : undefined,
  dbPath: process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'bot.db'),
  web: {
    enabled: process.env.WEB_ENABLED !== 'false',
    host: process.env.WEB_HOST ?? '127.0.0.1',
    port: Number(process.env.WEB_PORT ?? 3000),
    adminToken: process.env.WEB_ADMIN_TOKEN,
    publicUrl: process.env.WEB_PUBLIC_URL,
    initDataMaxAgeSec: Number(process.env.WEB_INIT_DATA_MAX_AGE_SEC ?? 3600),
  },
  timezone: process.env.TZ ?? 'Europe/Moscow',
  logLevel: process.env.LOG_LEVEL ?? 'info',
} as const;
