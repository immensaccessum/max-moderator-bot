import { Router } from 'express';
import type { Bot } from '@maxhub/max-bot-api';
import { DELETION_RETENTION_MS } from '../../modules/deletion-log/types.js';
import { parseChatId } from '../../utils/chat-id.js';
import { requireChatAdmin } from '../middleware/require-chat-admin.js';
import { listChatDeletionLogs } from '../services/deletion-log.js';

export function createDeletionLogRouter(bot: Bot): Router {
  const router = Router();
  const chatAdmin = requireChatAdmin(bot);

  router.get('/chats/:chatId/deletion-logs', chatAdmin, (req, res) => {
    const chatId = parseChatId(req.params.chatId);
    if (!chatId) {
      res.status(400).json({ error: 'Invalid chat id' });
      return;
    }

    const logs = listChatDeletionLogs(chatId);
    res.json({
      logs,
      retentionHours: DELETION_RETENTION_MS / (60 * 60 * 1000),
    });
  });

  return router;
}
