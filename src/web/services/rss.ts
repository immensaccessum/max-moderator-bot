import {
  createRssFeed,
  deleteRssFeed,
  getRssFeedRow,
  listRssFeeds,
  updateRssFeed,
} from '../../modules/rss/store.js';
import { postRssFeedLatest, postRssFeedTest } from '../../modules/rss/service.js';
import type { Bot } from '@maxhub/max-bot-api';
import type { RssFeedDto } from '../../modules/rss/types.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('api');

export function mapRssError(err: unknown): { status: number; message: string } | null {
  const message = err instanceof Error ? err.message : String(err);
  if (message === 'INVALID_FEED_URL') {
    return { status: 400, message: 'Укажите корректный URL ленты (http или https)' };
  }
  if (message === 'INVALID_POLL_INTERVAL') {
    return { status: 400, message: 'Интервал опроса: от 5 минут до 24 часов' };
  }
  if (message === 'FEED_EMPTY') {
    return { status: 400, message: 'Лента пуста или в ней нет записей' };
  }
  return null;
}

export function listChatRssFeeds(chatId: number): RssFeedDto[] {
  return listRssFeeds(chatId);
}

export async function createChatRssFeed(
  bot: Bot,
  input: {
    chatId: number;
    title?: string | null;
    feedUrl: string;
    pollIntervalMinutes?: number;
    includeDescription?: boolean;
    enabled?: boolean;
    postLatestOnAdd?: boolean;
  },
  actorUserId?: number,
): Promise<RssFeedDto> {
  const feed = createRssFeed(input);
  log.info('rss feed created', {
    feedId: feed.id,
    chatId: input.chatId,
    userId: actorUserId,
    enabled: feed.enabled,
    postLatestOnAdd: Boolean(input.postLatestOnAdd),
  });

  if (input.postLatestOnAdd) {
    const row = getRssFeedRow(feed.id, input.chatId);
    if (row) {
      await postRssFeedLatest(bot, row);
    }
  }

  return listRssFeeds(input.chatId).find((item) => item.id === feed.id) ?? feed;
}

export async function testChatRssFeed(
  bot: Bot,
  feedId: number,
  chatId: number,
  actorUserId?: number,
): Promise<{ title: string | null; link: string | null } | null> {
  const row = getRssFeedRow(feedId, chatId);
  if (!row) return null;

  const result = await postRssFeedTest(bot, row);
  log.info('rss feed tested', {
    feedId,
    chatId,
    userId: actorUserId,
    title: result.title,
  });
  return { title: result.title, link: result.link };
}

export function updateChatRssFeed(
  feedId: number,
  chatId: number,
  input: {
    title?: string | null;
    feedUrl?: string;
    pollIntervalMinutes?: number;
    includeDescription?: boolean;
    enabled?: boolean;
  },
  actorUserId?: number,
): RssFeedDto | null {
  const existing = listRssFeeds(chatId).find((item) => item.id === feedId);
  if (!existing) {
    return null;
  }

  const feed = updateRssFeed(feedId, input);
  log.info('rss feed updated', {
    feedId,
    chatId,
    userId: actorUserId,
    fields: Object.keys(input),
  });
  return feed;
}

export function deleteChatRssFeed(
  feedId: number,
  chatId: number,
  actorUserId?: number,
): boolean {
  const existing = listRssFeeds(chatId).find((item) => item.id === feedId);
  if (!existing) {
    return false;
  }

  deleteRssFeed(feedId);
  log.info('rss feed deleted', {
    feedId,
    chatId,
    userId: actorUserId,
  });
  return true;
}
