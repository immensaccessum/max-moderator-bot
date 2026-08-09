import { Bot } from '@maxhub/max-bot-api';
import { config } from './config.js';
import { registerCommands } from './handlers/commands.js';
import { registerEventHandlers } from './handlers/events.js';
import { registerSilenceHandlers, startSilenceExpiryWatcher } from './modules/silence/handlers.js';
import { startMinuteScheduleWatcher } from './modules/silence/schedule-watcher.js';
import { registerSettingsHandlers } from './modules/settings/handlers.js';
import { registerTriggerHandlers } from './modules/triggers/handlers.js';
import { startAutopostWatcher } from './modules/autopost/watcher.js';
import { startDeletionLogPurgeWatcher } from './modules/deletion-log/watcher.js';
import { registerPingHandlers } from './modules/ping/handlers.js';
import { startScheduledDeletionsWatcher } from './modules/scheduled-deletions/watcher.js';
import { createLogger } from './utils/logger.js';

const log = createLogger('bot');

export function createBot(): Bot {
  const bot = new Bot(config.botToken);

  bot.catch((err, ctx) => {
    log.error('unhandled bot error', {
      err,
      updateType: ctx.updateType,
      chatId: ctx.chatId,
    });
  });

  bot.api.setMyCommands([
    { name: 'start', description: 'Информация о боте' },
    { name: 'help', description: 'Справка по командам' },
    { name: 'myid', description: 'Узнать свой user_id' },
    { name: 'settings', description: 'Настройки чата (админы)' },
    { name: 'ping', description: 'Проверка задержки бота' },
  ]);

  registerCommands(bot);
  registerPingHandlers(bot);
  registerEventHandlers(bot);
  registerSettingsHandlers(bot);
  registerSilenceHandlers(bot);
  registerTriggerHandlers(bot);
  startSilenceExpiryWatcher(bot);
  startMinuteScheduleWatcher(bot);
  startAutopostWatcher(bot);
  startDeletionLogPurgeWatcher();
  startScheduledDeletionsWatcher(bot);

  log.info('handlers registered', {
    modules: ['settings', 'silence', 'triggers', 'autopost', 'deletion-log', 'scheduled-deletions', 'ping'],
  });

  return bot;
}
