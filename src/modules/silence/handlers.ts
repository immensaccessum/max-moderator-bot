import type { Bot, Context } from '@maxhub/max-bot-api';
import { isUserChatAdmin } from '../../utils/admin.js';
import { isGroupMessage } from '../../utils/chat.js';
import { getDb } from '../../db/index.js';
import { createLogger } from '../../utils/logger.js';
import { deleteAndRecord, formatSenderLabel } from '../deletion-log/service.js';
import {
  announceChatStatus,
  isSilenceActive,
  turnOffSilence,
} from './service.js';

const log = createLogger('silence');

async function handleSilenceMessage(ctx: Context, bot: Bot): Promise<boolean> {
  if (!ctx.chatId || !isGroupMessage(ctx)) {
    return false;
  }

  const sender = ctx.message?.sender;
  if (!sender || sender.is_bot) {
    return false;
  }
  if (sender.user_id === bot.botInfo?.user_id) {
    return false;
  }

  if (!isSilenceActive(ctx.chatId)) {
    return false;
  }

  if (await isUserChatAdmin(ctx, sender.user_id, ctx.chatId)) {
    return false;
  }

  const messageId = ctx.messageId;
  if (!messageId) {
    return false;
  }

  await deleteAndRecord(
    () => ctx.deleteMessage(messageId),
    {
      chatId: ctx.chatId,
      messageId,
      userId: sender.user_id,
      userLabel: formatSenderLabel(sender),
      messageText: ctx.message?.body?.text ?? null,
      source: 'silence',
      eventType: 'message_created',
    },
  );

  return true;
}

export function registerSilenceHandlers(bot: Bot): void {
  bot.on('message_created', async (ctx, next) => {
    const handled = await handleSilenceMessage(ctx, bot);
    if (handled) return;
    return next();
  });
}

export function startSilenceExpiryWatcher(bot: Bot): void {
  setInterval(async () => {
    const rows = getDb()
      .prepare(
        `SELECT chat_id, until_ms FROM silence_settings
         WHERE enabled = 1 AND until_ms IS NOT NULL`,
      )
      .all() as { chat_id: number; until_ms: number }[];

    const now = Date.now();

    for (const row of rows) {
      if (row.until_ms > now) continue;

      const wasActive = isSilenceActive(row.chat_id);
      turnOffSilence(row.chat_id);

      if (!wasActive || isSilenceActive(row.chat_id)) continue;

      try {
        await announceChatStatus(bot, row.chat_id);
      } catch (err) {
        log.error('failed to notify silence end', { err, chatId: row.chat_id });
      }
    }
  }, 30_000);
}
