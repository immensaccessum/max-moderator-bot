import type { Bot } from '@maxhub/max-bot-api';
import Parser from 'rss-parser';
import { createLogger } from '../../utils/logger.js';
import { RSS_MAX_CONSECUTIVE_FAILURES } from './constants.js';
import { RSS_MESSAGE_FORMAT, formatRssMessage, itemKey, pickNewFeedItems } from './feed.js';
import { listDueRssFeeds, recordRssFeedFailure, recordRssFeedSuccess } from './store.js';
import type { RssFeedItem, RssFeedRow } from './types.js';

const log = createLogger('rss');

const parser = new Parser({
  timeout: 20_000,
  headers: {
    'User-Agent': 'max-moderator-bot/0.1 (+https://github.com/immensaccessum/max-moderator-bot)',
    Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
  },
});

const POST_DELAY_MS = 600;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendRssMessage(bot: Bot, chatId: number, text: string): Promise<void> {
  await bot.api.sendMessageToChat(chatId, text, { format: RSS_MESSAGE_FORMAT });
}

async function fetchFeedItems(feedUrl: string): Promise<RssFeedItem[]> {
  const feed = await parser.parseURL(feedUrl);
  return (feed.items ?? []).map((item) => ({
    guid: item.guid,
    link: item.link,
    title: item.title,
    isoDate: item.isoDate,
    contentSnippet: item.contentSnippet,
  }));
}

export type RssPostPreview = {
  title: string | null;
  link: string | null;
  itemKey: string | null;
};

export async function postRssFeedTest(
  bot: Bot,
  feed: RssFeedRow,
): Promise<RssPostPreview> {
  try {
    const items = await fetchFeedItems(feed.feed_url);
    if (items.length === 0) {
      throw new Error('FEED_EMPTY');
    }

    const item = items[0];
    const text = formatRssMessage(item, feed.include_description === 1, { test: true });
    await sendRssMessage(bot, feed.chat_id, text);

    recordRssFeedSuccess(feed.id, {}, Date.now());

    log.info('rss test post sent', {
      feedId: feed.id,
      chatId: feed.chat_id,
      title: item.title,
      link: item.link,
    });

    return {
      title: item.title ?? null,
      link: item.link ?? null,
      itemKey: itemKey(item),
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    recordRssFeedFailure(feed.id, errorMessage);
    throw err;
  }
}

/** Публикует последнюю запись и помечает её как уже обработанную. */
export async function postRssFeedLatest(
  bot: Bot,
  feed: RssFeedRow,
): Promise<RssPostPreview> {
  try {
    const items = await fetchFeedItems(feed.feed_url);
    if (items.length === 0) {
      throw new Error('FEED_EMPTY');
    }

    const item = items[0];
    const key = itemKey(item);
    const text = formatRssMessage(item, feed.include_description === 1);
    await sendRssMessage(bot, feed.chat_id, text);
    const postedAt = Date.now();

    recordRssFeedSuccess(
      feed.id,
      { lastItemKey: key, lastPostedAt: postedAt },
      postedAt,
    );

    log.info('rss latest item posted', {
      feedId: feed.id,
      chatId: feed.chat_id,
      title: item.title,
      link: item.link,
    });

    return {
      title: item.title ?? null,
      link: item.link ?? null,
      itemKey: key,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    recordRssFeedFailure(feed.id, errorMessage);
    throw err;
  }
}

export async function processRssFeed(bot: Bot, feed: RssFeedRow): Promise<void> {
  const checkedAt = Date.now();

  try {
    const items = await fetchFeedItems(feed.feed_url);
    const { toPost, nextItemKey, baselineOnly } = pickNewFeedItems(
      items,
      feed.last_item_key,
    );

    if (baselineOnly) {
      recordRssFeedSuccess(feed.id, { lastItemKey: nextItemKey }, checkedAt);
      log.info('rss baseline set', {
        feedId: feed.id,
        chatId: feed.chat_id,
        itemKey: nextItemKey,
      });
      return;
    }

    if (toPost.length === 0) {
      recordRssFeedSuccess(feed.id, {}, checkedAt);
      return;
    }

    let lastPostedAt: number | null = null;

    for (const [index, item] of toPost.entries()) {
      const text = formatRssMessage(item, feed.include_description === 1);
      await sendRssMessage(bot, feed.chat_id, text);
      lastPostedAt = Date.now();
      log.info('rss item posted', {
        feedId: feed.id,
        chatId: feed.chat_id,
        title: item.title,
        link: item.link,
      });

      if (index < toPost.length - 1) {
        await sleep(POST_DELAY_MS);
      }
    }

    recordRssFeedSuccess(
      feed.id,
      { lastItemKey: nextItemKey, lastPostedAt },
      checkedAt,
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const autoDisabled = recordRssFeedFailure(feed.id, errorMessage, checkedAt);
    log.error('rss feed poll failed', {
      err,
      feedId: feed.id,
      chatId: feed.chat_id,
      feedUrl: feed.feed_url,
      autoDisabled,
    });
    if (autoDisabled) {
      log.warn('rss feed auto-disabled after consecutive failures', {
        feedId: feed.id,
        chatId: feed.chat_id,
        maxFailures: RSS_MAX_CONSECUTIVE_FAILURES,
      });
    }
  }
}

export async function processDueRssFeeds(bot: Bot): Promise<void> {
  const dueFeeds = listDueRssFeeds();

  for (const feed of dueFeeds) {
    await processRssFeed(bot, feed);
  }
}
