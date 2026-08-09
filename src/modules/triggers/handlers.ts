import type { Bot, Context } from '@maxhub/max-bot-api';
import { isGroupMessage } from '../../utils/chat.js';
import { formatSenderLabel } from '../deletion-log/service.js';
import { executeTriggerAction } from './execute.js';
import { matchesTrigger } from './matcher.js';
import { listEnabledTriggersForChat } from './store.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('trigger');

async function processTriggerMessage(ctx: Context, bot: Bot): Promise<void> {
  if (!ctx.chatId || !isGroupMessage(ctx)) {
    return;
  }

  const sender = ctx.message?.sender;
  if (!sender || sender.is_bot) {
    return;
  }
  if (sender.user_id === bot.botInfo?.user_id) {
    return;
  }

  const text = ctx.message?.body?.text?.trim();
  if (!text) {
    return;
  }

  const triggers = listEnabledTriggersForChat(ctx.chatId);
  if (triggers.length === 0) {
    return;
  }

  for (const trigger of triggers) {
    if (
      matchesTrigger(text, trigger.keyPhrase, trigger.matchType, trigger.caseSensitive)
    ) {
      log.info('matched', {
        triggerId: trigger.id,
        chatId: ctx.chatId,
        userId: sender.user_id,
        matchType: trigger.matchType,
        action: trigger.action,
        keyPhrase: trigger.keyPhrase,
      });

      await executeTriggerAction(ctx, trigger, {
        chatId: ctx.chatId,
        userId: sender.user_id,
        messageId: ctx.messageId,
        messageText: text,
        userLabel: formatSenderLabel(sender),
      });
      break;
    }
  }
}

export function registerTriggerHandlers(bot: Bot): void {
  bot.on('message_created', async (ctx, next) => {
    await processTriggerMessage(ctx, bot);
    return next();
  });

  bot.on('message_edited', async (ctx) => {
    await processTriggerMessage(ctx, bot);
  });

  log.info('handlers registered');
}
