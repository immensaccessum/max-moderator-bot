import type { BotContext } from '../types.js';

export function isGroupMessage(ctx: BotContext): boolean {
  return ctx.message?.recipient?.chat_type === 'chat';
}

export function getSenderId(ctx: BotContext): number | undefined {
  if (ctx.updateType === 'message_callback') {
    return ctx.callback?.user.user_id;
  }
  return ctx.message?.sender?.user_id;
}

export function getCallbackChatId(ctx: BotContext): number | undefined {
  if (ctx.updateType !== 'message_callback') return undefined;
  return ctx.message?.recipient?.chat_id ?? undefined;
}
