import type { Bot } from '@maxhub/max-bot-api';
import type { Request } from 'express';
import { listChatDtos, listChatDtosForUser } from '../services/chats.js';

export async function resolveChatList(bot: Bot, req: Request) {
  if (req.authMode === 'token' || !req.authUser) {
    return listChatDtos();
  }
  return listChatDtosForUser(bot, req.authUser.id);
}
