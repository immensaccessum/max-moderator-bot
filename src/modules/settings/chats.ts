import type { Chat } from '@maxhub/max-bot-api/types';
import type { BotContext } from '../../types.js';
import { isUserChatAdmin } from '../../utils/admin.js';

export async function getAdminChats(
  ctx: BotContext,
  userId: number,
): Promise<Chat[]> {
  const { chats } = await ctx.getAllChats();
  const groupChats = chats.filter((chat) => chat.type === 'chat' && chat.status === 'active');

  const adminChats: Chat[] = [];
  for (const chat of groupChats) {
    if (await isUserChatAdmin(ctx, userId, chat.chat_id)) {
      adminChats.push(chat);
    }
  }

  return adminChats;
}
