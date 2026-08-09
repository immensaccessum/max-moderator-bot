import { createLogger } from '../../utils/logger.js';
import { purgeExpiredDeletionLogs } from './store.js';

const log = createLogger('deletion-log');

export function startDeletionLogPurgeWatcher(): void {
  const tick = () => {
    const removed = purgeExpiredDeletionLogs();
    if (removed > 0) {
      log.info('purged expired records', { removed });
    }
  };

  tick();
  setInterval(tick, 60 * 60 * 1000);
  log.info('purge watcher started', { retentionHours: 48 });
}
