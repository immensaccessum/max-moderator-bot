import { Router } from 'express';
import type { Bot } from '@maxhub/max-bot-api';
import {
  SILENCE_DURATIONS,
  type SilenceDurationKey,
} from '../../modules/silence/constants.js';
import { announceChatStatus, isSilenceActive } from '../../modules/silence/service.js';
import { applyScheduleConfigChange } from '../../modules/silence/schedule-watcher.js';
import { parseChatId } from '../../utils/chat-id.js';
import { requireChatAdmin } from '../middleware/require-chat-admin.js';
import { toChatDto } from '../services/chats.js';
import {
  getSilenceMeta,
  parseDurationPresetsInput,
  updateChatSilence,
  updateChatSilenceConfig,
} from '../services/silence.js';

function isSilenceDurationKey(value: string): value is SilenceDurationKey {
  return value in SILENCE_DURATIONS;
}

function mapSilenceError(err: unknown): { status: number; message: string } | null {
  const message = err instanceof Error ? err.message : String(err);
  if (message === 'MANUAL_BLOCKED_BY_SCHEDULE' || message === 'SILENCE_ALREADY_ACTIVE') {
    return {
      status: 409,
      message: 'Ручная тишина недоступна: чат сейчас закрыт',
    };
  }
  if (message === 'SCHEDULE_BLOCKED_BY_MANUAL') {
    return { status: 409, message: 'Расписание недоступно: сначала выключите ручную тишину' };
  }
  return null;
}

export function createSilenceRouter(bot: Bot): Router {
  const router = Router();
  const chatAdmin = requireChatAdmin(bot);

  router.get('/meta', (_req, res) => {
    res.json(getSilenceMeta());
  });

  router.patch('/chats/:chatId/silence/config', chatAdmin, async (req, res, next) => {
    const chatId = parseChatId(req.params.chatId);
    if (!chatId) {
      res.status(400).json({ error: 'Invalid chat id' });
      return;
    }

    const body = req.body as {
      openSuffix?: string | null;
      closedSuffix?: string | null;
      durationPresets?: Array<{ minutes: number | null; label?: string }>;
      schedule?: {
        enabled?: boolean;
        startMinutes?: number;
        endMinutes?: number;
        timezone?: string | null;
        weekendsEnabled?: boolean;
      };
    };

    try {
      const wasOverallActive = isSilenceActive(chatId);

      updateChatSilenceConfig(chatId, {
        openSuffix: body.openSuffix,
        closedSuffix: body.closedSuffix,
        durationPresets: body.durationPresets
          ? parseDurationPresetsInput(body.durationPresets)
          : undefined,
        schedule: body.schedule,
      });

      if (body.schedule) {
        await applyScheduleConfigChange(bot, chatId, wasOverallActive);
      }

      const chat = toChatDto(chatId);
      res.json(chat);
    } catch (err) {
      const mapped = mapSilenceError(err);
      if (mapped) {
        res.status(mapped.status).json({ error: mapped.message });
        return;
      }
      next(err);
    }
  });

  router.patch('/chats/:chatId/silence', chatAdmin, async (req, res, next) => {
    const chatId = parseChatId(req.params.chatId);
    if (!chatId) {
      res.status(400).json({ error: 'Invalid chat id' });
      return;
    }

    const body = req.body as {
      enabled?: boolean;
      duration?: string;
      minutes?: number;
      forever?: boolean;
      announce?: boolean;
    };

    try {
      if (body.enabled === false) {
        const chat = updateChatSilence(chatId, { enabled: false });
        if (body.announce !== false) {
          await announceChatStatus(bot, chatId);
        }
        res.json(chat);
        return;
      }

      if (body.forever === true) {
        const chat = updateChatSilence(chatId, { forever: true });
        if (body.announce !== false) {
          await announceChatStatus(bot, chatId);
        }
        res.json(chat);
        return;
      }

      if (typeof body.minutes === 'number' && Number.isInteger(body.minutes) && body.minutes > 0) {
        const chat = updateChatSilence(chatId, { minutes: body.minutes });
        if (body.announce !== false) {
          await announceChatStatus(bot, chatId);
        }
        res.json(chat);
        return;
      }

      if (typeof body.duration === 'string' && isSilenceDurationKey(body.duration)) {
        const chat = updateChatSilence(chatId, { duration: body.duration });
        if (body.announce !== false) {
          await announceChatStatus(bot, chatId);
        }
        res.json(chat);
        return;
      }

      res.status(400).json({
        error:
          'Provide { enabled: false } | { minutes: number } | { forever: true } | { duration: "30m" | ... }',
      });
    } catch (err) {
      const mapped = mapSilenceError(err);
      if (mapped) {
        res.status(mapped.status).json({ error: mapped.message });
        return;
      }
      next(err);
    }
  });

  return router;
}
