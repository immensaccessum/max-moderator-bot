import type { Context } from '@maxhub/max-bot-api';
import { createLogger } from '../../utils/logger.js';
import { deleteAndRecord } from '../deletion-log/service.js';
import { scheduleMessageDeletion } from '../scheduled-deletions/service.js';
import type { TriggerDto } from './types.js';

const log = createLogger('trigger');

export async function executeTriggerAction(
  ctx: Context,
  trigger: TriggerDto,
  meta: { chatId: number; userId: number; messageId?: string; messageText?: string | null; userLabel?: string | null },
): Promise<void> {
  const shouldDelete = trigger.action === 'delete' || trigger.action === 'delete_reply';
  const shouldReply = trigger.action === 'reply' || trigger.action === 'delete_reply';
  const responseText = trigger.responseText.trim();

  if (shouldDelete && meta.messageId) {
    await deleteAndRecord(
      () => ctx.deleteMessage(meta.messageId!),
      {
        chatId: meta.chatId,
        messageId: meta.messageId,
        userId: meta.userId,
        userLabel: meta.userLabel,
        messageText: meta.messageText,
        source: 'trigger',
        sourceDetail: `Триггер #${trigger.id}: «${trigger.keyPhrase}»`,
        eventType: ctx.updateType === 'message_edited' ? 'message_edited' : 'message_created',
      },
    );
  }

  if (shouldReply && responseText) {
    try {
      const message = await ctx.api.sendMessageToChat(meta.chatId, responseText);
      log.info('reply sent', {
        triggerId: trigger.id,
        chatId: meta.chatId,
        autoDeleteReply: trigger.autoDeleteReply,
      });

      if (trigger.autoDeleteReply && message.body.mid) {
        scheduleMessageDeletion({
          chatId: meta.chatId,
          messageId: message.body.mid,
          messageText: responseText,
          source: 'trigger',
          sourceDetail: `Автоудаление ответа триггера #${trigger.id} (1 мин)`,
        });
      }
    } catch (err) {
      log.error('reply failed', {
        err,
        triggerId: trigger.id,
        chatId: meta.chatId,
      });
    }
  }
}
