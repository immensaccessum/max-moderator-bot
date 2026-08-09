import { Router } from 'express';
import type { Bot } from '@maxhub/max-bot-api';
import { parseChatId } from '../../utils/chat-id.js';
import { requireChatAdmin } from '../middleware/require-chat-admin.js';
import {
  createChatRssFeed,
  deleteChatRssFeed,
  listChatRssFeeds,
  mapRssError,
  testChatRssFeed,
  updateChatRssFeed,
} from '../services/rss.js';

export function createRssRouter(bot: Bot): Router {
  const router = Router();
  const chatAdmin = requireChatAdmin(bot);

  router.get('/chats/:chatId/rss-feeds', chatAdmin, (req, res) => {
    const chatId = parseChatId(req.params.chatId);
    if (!chatId) {
      res.status(400).json({ error: 'Invalid chat id' });
      return;
    }
    res.json({ feeds: listChatRssFeeds(chatId) });
  });

  router.post('/chats/:chatId/rss-feeds', chatAdmin, async (req, res, next) => {
    const chatId = parseChatId(req.params.chatId);
    if (!chatId) {
      res.status(400).json({ error: 'Invalid chat id' });
      return;
    }

    const body = req.body as {
      title?: string | null;
      feedUrl?: string;
      pollIntervalMinutes?: number;
      includeDescription?: boolean;
      enabled?: boolean;
      postLatestOnAdd?: boolean;
    };

    try {
      const feed = await createChatRssFeed(
        bot,
        {
          chatId,
          title: body.title,
          feedUrl: body.feedUrl ?? '',
          pollIntervalMinutes: body.pollIntervalMinutes,
          includeDescription: body.includeDescription,
          enabled: body.enabled,
          postLatestOnAdd: body.postLatestOnAdd,
        },
        req.authUser?.id,
      );
      res.status(201).json(feed);
    } catch (err) {
      const mapped = mapRssError(err);
      if (mapped) {
        res.status(mapped.status).json({ error: mapped.message });
        return;
      }
      next(err);
    }
  });

  router.patch('/chats/:chatId/rss-feeds/:feedId', chatAdmin, (req, res, next) => {
    const chatId = parseChatId(req.params.chatId);
    const feedId = Number(req.params.feedId);
    if (!chatId || !Number.isInteger(feedId)) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }

    const body = req.body as {
      title?: string | null;
      feedUrl?: string;
      pollIntervalMinutes?: number;
      includeDescription?: boolean;
      enabled?: boolean;
    };

    try {
      const feed = updateChatRssFeed(feedId, chatId, body, req.authUser?.id);
      if (!feed) {
        res.status(404).json({ error: 'RSS feed not found' });
        return;
      }
      res.json(feed);
    } catch (err) {
      const mapped = mapRssError(err);
      if (mapped) {
        res.status(mapped.status).json({ error: mapped.message });
        return;
      }
      next(err);
    }
  });

  router.post('/chats/:chatId/rss-feeds/:feedId/test', chatAdmin, async (req, res, next) => {
    const chatId = parseChatId(req.params.chatId);
    const feedId = Number(req.params.feedId);
    if (!chatId || !Number.isInteger(feedId)) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }

    try {
      const result = await testChatRssFeed(bot, feedId, chatId, req.authUser?.id);
      if (!result) {
        res.status(404).json({ error: 'RSS feed not found' });
        return;
      }
      res.json({ ok: true, ...result });
    } catch (err) {
      const mapped = mapRssError(err);
      if (mapped) {
        res.status(mapped.status).json({ error: mapped.message });
        return;
      }
      next(err);
    }
  });

  router.delete('/chats/:chatId/rss-feeds/:feedId', chatAdmin, (req, res) => {
    const chatId = parseChatId(req.params.chatId);
    const feedId = Number(req.params.feedId);
    if (!chatId || !Number.isInteger(feedId)) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }

    const deleted = deleteChatRssFeed(feedId, chatId, req.authUser?.id);
    if (!deleted) {
      res.status(404).json({ error: 'RSS feed not found' });
      return;
    }

    res.json({ ok: true });
  });

  return router;
}
