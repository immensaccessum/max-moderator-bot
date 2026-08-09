import type { Bot } from '@maxhub/max-bot-api';
import { ensureChat } from '../db/chats.js';
import { registerChatWithTitle } from '../modules/chats/service.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('events');

export function registerEventHandlers(bot: Bot): void {
  bot.on('bot_added', async (ctx) => {
    await registerChatWithTitle(ctx.api, ctx.update.chat_id);

    await ctx.api.sendMessageToChat(
      ctx.update.chat_id,
      'Спасибо, что добавили меня!\n\n' +
        'Выдайте права администратора с удалением сообщений, если нужна модерация в режиме тишины.',
    );
  });

  bot.on('bot_removed', (ctx) => {
    log.info('bot removed from chat', { chatId: ctx.update.chat_id });
  });

  bot.on('chat_title_changed', (ctx) => {
    ensureChat(ctx.update.chat_id, ctx.update.title);
  });
}
