import type { Bot } from '@maxhub/max-bot-api';
import type { BotContext } from '../types.js';
import { getSenderId } from './chat.js';

type AdminCacheEntry = {
  isAdmin: boolean;
  expiresAt: number;
};

const ADMIN_CACHE_TTL_MS = 60_000;
const adminCache = new Map<string, AdminCacheEntry>();

function cacheKey(chatId: number, userId: number): string {
  return `${chatId}:${userId}`;
}

function getCachedAdmin(chatId: number, userId: number): boolean | undefined {
  const key = cacheKey(chatId, userId);
  const entry = adminCache.get(key);
  if (!entry) return undefined;
  if (Date.now() >= entry.expiresAt) {
    adminCache.delete(key);
    return undefined;
  }
  return entry.isAdmin;
}

function setCachedAdmin(chatId: number, userId: number, isAdmin: boolean): void {
  adminCache.set(cacheKey(chatId, userId), {
    isAdmin,
    expiresAt: Date.now() + ADMIN_CACHE_TTL_MS,
  });
}

export function clearAdminCache(chatId?: number, userId?: number): void {
  if (chatId === undefined && userId === undefined) {
    adminCache.clear();
    return;
  }

  for (const key of adminCache.keys()) {
    const [cachedChatId, cachedUserId] = key.split(':');
    if (chatId !== undefined && Number(cachedChatId) !== chatId) continue;
    if (userId !== undefined && Number(cachedUserId) !== userId) continue;
    adminCache.delete(key);
  }
}

export async function isBotUserChatAdmin(
  bot: Bot,
  userId: number,
  chatId: number,
): Promise<boolean> {
  const cached = getCachedAdmin(chatId, userId);
  if (cached !== undefined) return cached;

  const { members } = await bot.api.getChatMembers(chatId, {
    user_ids: [userId],
  });

  const member = members[0];
  const isAdmin = Boolean(member?.is_admin || member?.is_owner);
  setCachedAdmin(chatId, userId, isAdmin);
  return isAdmin;
}

export async function isUserChatAdmin(
  ctx: BotContext,
  userId: number,
  chatId?: number,
): Promise<boolean> {
  const targetChatId = chatId ?? resolveChatId(ctx);
  if (!targetChatId) return false;

  const cached = getCachedAdmin(targetChatId, userId);
  if (cached !== undefined) return cached;

  const { members } = await ctx.api.getChatMembers(targetChatId, {
    user_ids: [userId],
  });

  const member = members[0];
  const isAdmin = Boolean(member?.is_admin || member?.is_owner);
  setCachedAdmin(targetChatId, userId, isAdmin);
  return isAdmin;
}

export function resolveChatId(ctx: BotContext): number | undefined {
  if (ctx.chatId) return ctx.chatId;
  if (ctx.updateType === 'message_callback') {
    return ctx.message?.recipient?.chat_id ?? undefined;
  }
  return undefined;
}

export async function requireChatAdmin(ctx: BotContext): Promise<boolean> {
  const userId = getSenderId(ctx);
  const chatId = resolveChatId(ctx);

  if (!userId || !chatId) return false;

  return isUserChatAdmin(ctx, userId, chatId);
}

export async function requireChatAdminFor(
  ctx: BotContext,
  targetChatId: number,
  userId?: number,
): Promise<boolean> {
  const uid = userId ?? getSenderId(ctx);
  if (!uid) return false;

  return isUserChatAdmin(ctx, uid, targetChatId);
}
