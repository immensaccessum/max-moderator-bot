import type { Bot } from '@maxhub/max-bot-api';
import { createLogger } from '../../utils/logger.js';
import { executeScheduledDeletion } from './service.js';
import { listDueScheduledDeletions } from './store.js';

const log = createLogger('scheduled-deletions');

const TICK_INTERVAL_MS = 15_000;

export function startScheduledDeletionsWatcher(bot: Bot): void {
  const tick = async () => {
    const due = listDueScheduledDeletions();
    if (due.length === 0) return;

    log.debug('processing due deletions', { count: due.length });

    for (const row of due) {
      await executeScheduledDeletion(bot.api, row);
    }
  };

  log.info('watcher started', { intervalSec: TICK_INTERVAL_MS / 1000 });
  void tick();
  setInterval(() => {
    void tick();
  }, TICK_INTERVAL_MS);
}
