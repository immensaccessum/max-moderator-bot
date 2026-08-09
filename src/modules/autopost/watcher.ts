import type { Bot } from '@maxhub/max-bot-api';
import { shouldPostNow } from './schedule.js';
import { listEnabledAutoposts, markAutopostPosted } from './store.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('autopost');

export function startAutopostWatcher(bot: Bot): void {
  const tick = async () => {
    const schedules = listEnabledAutoposts();
    const now = new Date();
    let dueCount = 0;
    let postedCount = 0;
    let failedCount = 0;

    log.debug('tick', { enabledSchedules: schedules.length });

    for (const schedule of schedules) {
      if (!shouldPostNow(schedule, now)) continue;
      dueCount += 1;

      try {
        await bot.api.sendMessageToChat(schedule.chat_id, schedule.message_text);
        markAutopostPosted(schedule.id, now.getTime());
        postedCount += 1;
        log.info('message posted', {
          scheduleId: schedule.id,
          chatId: schedule.chat_id,
          scheduleType: schedule.schedule_type,
          title: schedule.title,
        });
      } catch (err) {
        failedCount += 1;
        log.error('post failed', {
          err,
          scheduleId: schedule.id,
          chatId: schedule.chat_id,
          scheduleType: schedule.schedule_type,
        });
      }
    }

    if (dueCount > 0 || failedCount > 0) {
      log.info('tick complete', { dueCount, postedCount, failedCount });
    }
  };

  log.info('watcher started', { intervalSec: 60 });
  void tick();
  setInterval(() => {
    void tick();
  }, 60_000);
}
