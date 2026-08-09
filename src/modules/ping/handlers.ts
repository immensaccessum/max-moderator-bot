import { createRequire } from 'node:module';
import os from 'node:os';

import type { Bot } from '@maxhub/max-bot-api';
import { ensureChat } from '../../db/chats.js';
import { config } from '../../config.js';
import type { BotContext } from '../../types.js';
import { deleteAndRecord, formatSenderLabel } from '../deletion-log/service.js';
import { scheduleMessageDeletion } from '../scheduled-deletions/service.js';
import { isSilenceActive } from '../silence/service.js';
import { listEnabledTriggersForChat } from '../triggers/store.js';
import { isGroupMessage } from '../../utils/chat.js';
import { createLogger } from '../../utils/logger.js';

const require = createRequire(import.meta.url);
const appVersion = require('../../../package.json').version as string;

const log = createLogger('ping');

function resolveChatId(ctx: BotContext): number | undefined {
  if (ctx.chatId) return ctx.chatId;
  return ctx.message?.recipient?.chat_id ?? undefined;
}

function messageDeliveryMs(ctx: BotContext, handlerStartedAt: number): number | undefined {
  const timestamp = ctx.message?.timestamp;
  if (!timestamp) return undefined;

  const messageAt = timestamp > 1e12 ? timestamp : timestamp * 1000;
  const delivery = handlerStartedAt - messageAt;
  if (delivery < 0 || delivery > 60_000) return undefined;
  return delivery;
}

function formatUptime(seconds: number): string {
  const total = Math.floor(seconds);
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);

  if (days > 0) return `${days}д ${hours}ч`;
  if (hours > 0) return `${hours}ч ${minutes}м`;
  if (minutes > 0) return `${minutes}м ${total % 60}с`;
  return `${total}с`;
}

function getInstanceLabel(): string {
  const fromEnv = process.env.DEPLOY_INSTANCE?.trim();
  if (fromEnv) return fromEnv;

  const publicUrl = config.web.publicUrl;
  if (publicUrl) {
    try {
      const host = new URL(publicUrl).hostname;
      const short = host.split('.')[0];
      if (short) return short;
    } catch {
      // ignore invalid URL
    }
  }

  return os.hostname();
}

function buildBotLine(): string {
  return `Бот: ${formatUptime(process.uptime())} · v${appVersion} · ${getInstanceLabel()}`;
}

function buildChatLine(ctx: BotContext, chatId?: number): string {
  const chatType = ctx.message?.recipient?.chat_type;
  const typeLabel =
    chatType === 'chat' ? 'группа' : chatType === 'channel' ? 'канал' : 'личка';

  if (!chatId || chatType !== 'chat') {
    return `Чат: ${typeLabel}`;
  }

  const silenceLabel = isSilenceActive(chatId) ? 'закрыт' : 'открыт';
  const triggerCount = listEnabledTriggersForChat(chatId).length;

  return `Чат: ${typeLabel} · тишина ${silenceLabel} · триггеры: ${triggerCount}`;
}

function buildPingLine(metrics: {
  totalMs: number;
  apiMs: number;
  editMs: number;
  deleteMs: number;
  deliveryMs?: number;
}): string {
  const parts = [
    `API ${metrics.apiMs}`,
    `edit ${metrics.editMs}`,
    `delete ${metrics.deleteMs}`,
  ];

  if (metrics.deliveryMs !== undefined) {
    parts.push(`доставка ${metrics.deliveryMs}`);
  }

  return `🏓 ${metrics.totalMs} мс (${parts.join(' · ')})`;
}

async function deleteUserPingMessage(ctx: BotContext): Promise<void> {
  const messageId = ctx.messageId;
  if (!messageId) return;

  const chatId = resolveChatId(ctx);
  const sender = ctx.message?.sender;

  if (!chatId) {
    try {
      await ctx.deleteMessage(messageId);
    } catch (err) {
      log.error('failed to delete /ping command', { err, messageId });
    }
    return;
  }

  if (!isGroupMessage(ctx)) {
    try {
      await ctx.deleteMessage(messageId);
    } catch (err) {
      log.error('failed to delete /ping command in dialog', { err, messageId, chatId });
    }
    return;
  }

  ensureChat(chatId);

  await deleteAndRecord(
    () => ctx.deleteMessage(messageId),
    {
      chatId,
      messageId,
      userId: sender?.user_id,
      userLabel: formatSenderLabel(sender),
      messageText: ctx.message?.body?.text ?? '/ping',
      source: 'ping',
      sourceDetail: 'Команда /ping',
      eventType: 'message_created',
    },
  );
}

export function registerPingHandlers(bot: Bot): void {
  bot.command('ping', async (ctx) => {
    const startedAt = Date.now();
    const chatId = resolveChatId(ctx);
    const deliveryMs = messageDeliveryMs(ctx, startedAt);

    let deleteMs = 0;
    try {
      const deleteStartedAt = Date.now();
      await deleteUserPingMessage(ctx);
      deleteMs = Date.now() - deleteStartedAt;
    } catch (err) {
      log.error('failed to delete /ping command', { err, chatId, messageId: ctx.messageId });
    }

    const beforeReplyAt = Date.now();
    const response = await ctx.reply('⏳');
    const responseMessageId = response.body.mid;
    const apiMs = Date.now() - beforeReplyAt;

    const botLine = buildBotLine();
    const chatLine = buildChatLine(ctx, chatId);

    const beforeEditAt = Date.now();
    let finalText = [
      buildPingLine({
        totalMs: deleteMs + apiMs + (deliveryMs ?? 0),
        apiMs,
        editMs: 0,
        deleteMs,
        deliveryMs,
      }),
      botLine,
      chatLine,
    ].join('\n');

    try {
      await ctx.api.editMessage(responseMessageId, { text: finalText });
    } catch (err) {
      log.error('failed to edit ping response', { err, chatId, responseMessageId });
    }

    const editMs = Date.now() - beforeEditAt;
    const totalMs = Date.now() - startedAt;

    finalText = [
      buildPingLine({ totalMs, apiMs, editMs, deleteMs, deliveryMs }),
      botLine,
      chatLine,
    ].join('\n');

    try {
      await ctx.api.editMessage(responseMessageId, { text: finalText });
    } catch (err) {
      log.error('failed to finalize ping response', { err, chatId, responseMessageId });
    }

    if (chatId && isGroupMessage(ctx)) {
      scheduleMessageDeletion({
        chatId,
        messageId: responseMessageId,
        messageText: finalText,
        source: 'ping',
        sourceDetail: 'Автоудаление ответа /ping (1 мин)',
      });
    }
  });

  log.info('handlers registered');
}
