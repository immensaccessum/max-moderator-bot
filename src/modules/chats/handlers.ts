import type { Bot } from '@maxhub/max-bot-api';
import type { BotContext } from '../../types.js';
import { getCallbackChatId, isGroupMessage } from '../../utils/chat.js';
import { trackChatId } from './service.js';

function trackGroupMessage(ctx: BotContext): void {
  if (!isGroupMessage(ctx) || !ctx.chatId) return;
  trackChatId(ctx.chatId);
}

export function registerChatRegistryHandlers(bot: Bot): void {
  bot.on('message_created', async (ctx, next) => {
    trackGroupMessage(ctx);
    return next();
  });

  bot.on('message_edited', async (ctx, next) => {
    trackGroupMessage(ctx);
    return next();
  });

  bot.on('message_callback', async (ctx, next) => {
    const chatId = getCallbackChatId(ctx);
    if (chatId) trackChatId(chatId);
    return next();
  });
}
