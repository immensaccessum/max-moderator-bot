import type { Api, Bot } from '@maxhub/max-bot-api';
import type { Chat } from '@maxhub/max-bot-api/types';
import { ensureChat, listChats } from '../../db/chats.js';
import type { BotContext } from '../../types.js';
import { isUserChatAdmin } from '../../utils/admin.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('chats');

export function trackChatId(chatId: number): void {
  ensureChat(chatId);
}

export async function registerChatWithTitle(api: Api, chatId: number): Promise<void> {
  try {
    const info = await api.getChat(chatId);
    if (info.type === 'chat' && info.status === 'active') {
      ensureChat(chatId, info.title);
      return;
    }
  } catch (err) {
    log.warn('failed to fetch chat info', { chatId, err });
  }

  ensureChat(chatId);
}

export async function refreshKnownChats(
  bot: Bot,
): Promise<{ refreshed: number; skipped: number }> {
  let refreshed = 0;
  let skipped = 0;

  for (const record of listChats()) {
    try {
      const info = await bot.api.getChat(record.chatId);
      if (info.type !== 'chat' || info.status !== 'active') {
        skipped += 1;
        continue;
      }

      ensureChat(record.chatId, info.title);
      refreshed += 1;
    } catch (err) {
      skipped += 1;
      log.warn('skip chat refresh', { chatId: record.chatId, err });
    }
  }

  return { refreshed, skipped };
}

export async function getAdminChats(ctx: BotContext, userId: number): Promise<Chat[]> {
  const adminChats: Chat[] = [];

  for (const record of listChats()) {
    try {
      const info = await ctx.api.getChat(record.chatId);
      if (info.type !== 'chat' || info.status !== 'active') {
        continue;
      }

      ensureChat(record.chatId, info.title);

      if (await isUserChatAdmin(ctx, userId, record.chatId)) {
        adminChats.push(info);
      }
    } catch (err) {
      log.warn('skip chat in admin list', { chatId: record.chatId, userId, err });
    }
  }

  return adminChats;
}
