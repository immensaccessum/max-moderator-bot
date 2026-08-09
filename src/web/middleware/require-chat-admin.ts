import type { NextFunction, Request, Response } from 'express';
import type { Bot } from '@maxhub/max-bot-api';
import { isBotUserChatAdmin } from '../../utils/admin.js';
import { parseChatId } from '../../utils/chat-id.js';

export function requireChatAdmin(bot: Bot) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.authMode === 'token') {
      next();
      return;
    }

    const userId = req.authUser?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const chatId = parseChatId(req.params.chatId);
    if (!chatId) {
      res.status(400).json({ error: 'Invalid chat id' });
      return;
    }

    const isAdmin = await isBotUserChatAdmin(bot, userId, chatId);
    if (!isAdmin) {
      res.status(403).json({ error: 'Нет прав администратора в этом чате' });
      return;
    }

    next();
  };
}
