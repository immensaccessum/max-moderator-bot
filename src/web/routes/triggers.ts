import { Router } from 'express';
import type { Bot } from '@maxhub/max-bot-api';
import type { TriggerAction, TriggerMatchType } from '../../modules/triggers/types.js';
import { parseChatId } from '../../utils/chat-id.js';
import { requireChatAdmin } from '../middleware/require-chat-admin.js';
import {
  createChatTrigger,
  deleteChatTrigger,
  listChatTriggers,
  mapTriggerError,
  updateChatTrigger,
} from '../services/triggers.js';

export function createTriggersRouter(bot: Bot): Router {
  const router = Router();
  const chatAdmin = requireChatAdmin(bot);

  router.get('/chats/:chatId/triggers', chatAdmin, (req, res) => {
    const chatId = parseChatId(req.params.chatId);
    if (!chatId) {
      res.status(400).json({ error: 'Invalid chat id' });
      return;
    }
    res.json({ triggers: listChatTriggers(chatId) });
  });

  router.post('/chats/:chatId/triggers', chatAdmin, (req, res, next) => {
    const chatId = parseChatId(req.params.chatId);
    if (!chatId) {
      res.status(400).json({ error: 'Invalid chat id' });
      return;
    }

    const body = req.body as {
      keyPhrase?: string;
      responseText?: string;
      matchType?: TriggerMatchType;
      action?: TriggerAction;
      caseSensitive?: boolean;
      enabled?: boolean;
      autoDeleteReply?: boolean;
    };

    if (!body.keyPhrase?.trim()) {
      res.status(400).json({ error: 'Укажите ключевую фразу' });
      return;
    }

    try {
      const trigger = createChatTrigger(
        {
          chatId,
          keyPhrase: body.keyPhrase,
          responseText: body.responseText,
          matchType: body.matchType,
          action: body.action,
          caseSensitive: body.caseSensitive,
          enabled: body.enabled,
          autoDeleteReply: body.autoDeleteReply,
        },
        req.authUser?.id,
      );
      res.status(201).json(trigger);
    } catch (err) {
      const mapped = mapTriggerError(err);
      if (mapped) {
        res.status(mapped.status).json({ error: mapped.message });
        return;
      }
      next(err);
    }
  });

  router.patch('/chats/:chatId/triggers/:triggerId', chatAdmin, (req, res, next) => {
    const chatId = parseChatId(req.params.chatId);
    const triggerId = Number(req.params.triggerId);
    if (!chatId || !Number.isInteger(triggerId)) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }

    const body = req.body as {
      keyPhrase?: string;
      responseText?: string;
      matchType?: TriggerMatchType;
      action?: TriggerAction;
      caseSensitive?: boolean;
      enabled?: boolean;
      autoDeleteReply?: boolean;
    };

    try {
      const trigger = updateChatTrigger(triggerId, chatId, body, req.authUser?.id);
      if (!trigger) {
        res.status(404).json({ error: 'Trigger not found' });
        return;
      }
      res.json(trigger);
    } catch (err) {
      const mapped = mapTriggerError(err);
      if (mapped) {
        res.status(mapped.status).json({ error: mapped.message });
        return;
      }
      next(err);
    }
  });

  router.delete('/chats/:chatId/triggers/:triggerId', chatAdmin, (req, res) => {
    const chatId = parseChatId(req.params.chatId);
    const triggerId = Number(req.params.triggerId);
    if (!chatId || !Number.isInteger(triggerId)) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }

    const deleted = deleteChatTrigger(triggerId, chatId, req.authUser?.id);
    if (!deleted) {
      res.status(404).json({ error: 'Trigger not found' });
      return;
    }

    res.json({ ok: true });
  });

  return router;
}
