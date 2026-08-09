import type { Bot } from '@maxhub/max-bot-api';
import { createLogger } from '../../utils/logger.js';
import { processDueRssFeeds } from './service.js';

const log = createLogger('rss');

const WATCHER_INTERVAL_MS = 60_000;

export function startRssWatcher(bot: Bot): void {
  const tick = async () => {
    try {
      await processDueRssFeeds(bot);
    } catch (err) {
      log.error('rss watcher tick failed', { err });
    }
  };

  log.info('watcher started', { intervalSec: WATCHER_INTERVAL_MS / 1000 });
  void tick();
  setInterval(() => {
    void tick();
  }, WATCHER_INTERVAL_MS);
}
