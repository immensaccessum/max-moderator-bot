import { Router } from 'express';
import type { Bot } from '@maxhub/max-bot-api';
import { parseChatId } from '../../utils/chat-id.js';
import { requireChatAdmin } from '../middleware/require-chat-admin.js';
import { refreshKnownChatsFromBot, toChatDto } from '../services/chats.js';
import { resolveChatList } from './helpers.js';

export function createChatsRouter(bot: Bot): Router {
  const router = Router();
  const chatAdmin = requireChatAdmin(bot);

  router.get('/chats', async (req, res, next) => {
    try {
      const chats = await resolveChatList(bot, req);
      res.json({ chats });
    } catch (err) {
      next(err);
    }
  });

  router.post('/chats/sync', async (req, res, next) => {
    try {
      const result = await refreshKnownChatsFromBot(bot);
      const chats = await resolveChatList(bot, req);
      res.json({ ...result, chats });
    } catch (err) {
      next(err);
    }
  });

  router.get('/chats/:chatId', chatAdmin, (req, res) => {
    const chatId = parseChatId(req.params.chatId);
    if (!chatId) {
      res.status(400).json({ error: 'Invalid chat id' });
      return;
    }

    const chat = toChatDto(chatId);
    if (!chat) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }

    res.json(chat);
  });

  return router;
}
