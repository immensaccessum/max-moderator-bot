import type { Bot } from '@maxhub/max-bot-api';
import { createBot } from './bot.js';
import { initDb } from './db/index.js';
import { createLogger } from './utils/logger.js';
import { startWebServer } from './web/server.js';

const log = createLogger('app');

const ALLOWED_UPDATES = [
  'message_created',
  'message_edited',
  'message_callback',
  'message_removed',
  'bot_added',
  'bot_removed',
  'chat_title_changed',
  'user_added',
  'user_removed',
] as const;

export async function startApp(): Promise<Bot> {
  initDb();

  const bot = createBot();
  startWebServer(bot);

  log.info('starting bot polling');
  await bot.start({ allowedUpdates: [...ALLOWED_UPDATES] });
  log.info('bot polling started');

  return bot;
}
