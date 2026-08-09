import { Router } from 'express';
import type { Bot } from '@maxhub/max-bot-api';
import { authMiddleware } from '../middleware/auth.js';
import { createAutopostRouter } from './autopost.js';
import { createChatsRouter } from './chats.js';
import { createDeletionLogRouter } from './deletion-log.js';
import { createRssRouter } from './rss.js';
import { createSilenceRouter } from './silence.js';
import { createSystemRouter } from './system.js';
import { createTriggersRouter } from './triggers.js';

export function createApiRouter(bot: Bot): Router {
  const router = Router();

  router.use(authMiddleware);
  router.use(createSystemRouter());
  router.use(createSilenceRouter(bot));
  router.use(createChatsRouter(bot));
  router.use(createTriggersRouter(bot));
  router.use(createAutopostRouter(bot));
  router.use(createRssRouter(bot));
  router.use(createDeletionLogRouter(bot));

  return router;
}
