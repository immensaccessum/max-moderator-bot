import { Router } from 'express';
import type { Bot } from '@maxhub/max-bot-api';
import type { AutopostScheduleType } from '../../modules/autopost/types.js';
import { parseChatId } from '../../utils/chat-id.js';
import { requireChatAdmin } from '../middleware/require-chat-admin.js';
import {
  createChatAutopost,
  deleteChatAutopost,
  listChatAutoposts,
  mapAutopostError,
  updateChatAutopost,
} from '../services/autopost.js';

export function createAutopostRouter(bot: Bot): Router {
  const router = Router();
  const chatAdmin = requireChatAdmin(bot);

  router.get('/chats/:chatId/autoposts', chatAdmin, (req, res) => {
    const chatId = parseChatId(req.params.chatId);
    if (!chatId) {
      res.status(400).json({ error: 'Invalid chat id' });
      return;
    }
    res.json({ autoposts: listChatAutoposts(chatId) });
  });

  router.post('/chats/:chatId/autoposts', chatAdmin, (req, res, next) => {
    const chatId = parseChatId(req.params.chatId);
    if (!chatId) {
      res.status(400).json({ error: 'Invalid chat id' });
      return;
    }

    const body = req.body as {
      title?: string | null;
      messageText?: string;
      scheduleType?: AutopostScheduleType;
      weekday?: number | null;
      hour?: number | null;
      minute?: number | null;
      intervalMinutes?: number | null;
      timezone?: string | null;
      enabled?: boolean;
    };

    try {
      const autopost = createChatAutopost(
        {
          chatId,
          title: body.title,
          messageText: body.messageText ?? '',
          scheduleType: body.scheduleType ?? 'daily',
          weekday: body.weekday,
          hour: body.hour,
          minute: body.minute,
          intervalMinutes: body.intervalMinutes,
          timezone: body.timezone,
          enabled: body.enabled,
        },
        req.authUser?.id,
      );
      res.status(201).json(autopost);
    } catch (err) {
      const mapped = mapAutopostError(err);
      if (mapped) {
        res.status(mapped.status).json({ error: mapped.message });
        return;
      }
      next(err);
    }
  });

  router.patch('/chats/:chatId/autoposts/:autopostId', chatAdmin, (req, res, next) => {
    const chatId = parseChatId(req.params.chatId);
    const autopostId = Number(req.params.autopostId);
    if (!chatId || !Number.isInteger(autopostId)) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }

    const body = req.body as {
      title?: string | null;
      messageText?: string;
      scheduleType?: AutopostScheduleType;
      weekday?: number | null;
      hour?: number | null;
      minute?: number | null;
      intervalMinutes?: number | null;
      timezone?: string | null;
      enabled?: boolean;
    };

    try {
      const autopost = updateChatAutopost(autopostId, chatId, body, req.authUser?.id);
      if (!autopost) {
        res.status(404).json({ error: 'Autopost not found' });
        return;
      }
      res.json(autopost);
    } catch (err) {
      const mapped = mapAutopostError(err);
      if (mapped) {
        res.status(mapped.status).json({ error: mapped.message });
        return;
      }
      next(err);
    }
  });

  router.delete('/chats/:chatId/autoposts/:autopostId', chatAdmin, (req, res) => {
    const chatId = parseChatId(req.params.chatId);
    const autopostId = Number(req.params.autopostId);
    if (!chatId || !Number.isInteger(autopostId)) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }

    const deleted = deleteChatAutopost(autopostId, chatId, req.authUser?.id);
    if (!deleted) {
      res.status(404).json({ error: 'Autopost not found' });
      return;
    }

    res.json({ ok: true });
  });

  return router;
}
