import type { Bot } from '@maxhub/max-bot-api';
import { ensureChat } from '../db/chats.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('events');

export function registerEventHandlers(bot: Bot): void {
  bot.on('bot_added', async (ctx) => {
    ensureChat(ctx.update.chat_id);

    await ctx.api.sendMessageToChat(
      ctx.update.chat_id,
      'Спасибо, что добавили меня!\n\n' +
        'Выдайте права администратора с удалением сообщений.\n' +
        'Админы настраивают бота в личке — напишите мне /settings',
    );
  });

  bot.on('bot_removed', (ctx) => {
    log.info('bot removed from chat', { chatId: ctx.update.chat_id });
  });
}
