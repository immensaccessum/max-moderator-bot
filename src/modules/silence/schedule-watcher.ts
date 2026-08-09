import type { Bot } from '@maxhub/max-bot-api';
import { createLogger } from '../../utils/logger.js';
import {
  announceChatStatus,
  isScheduleSilenceActive,
  isSilenceActive,
  releaseManualSilenceForSchedule,
} from './service.js';
import {
  getScheduleLastInWindow,
  getSilenceSettings,
  listScheduledChatIds,
  setScheduleLastInWindow,
} from './store.js';

const log = createLogger('silence-schedule');

export function initScheduleTracking(): void {
  for (const chatId of listScheduledChatIds()) {
    if (isScheduleSilenceActive(chatId)) {
      releaseManualSilenceForSchedule(chatId);
    }

    if (getScheduleLastInWindow(chatId) === null) {
      setScheduleLastInWindow(chatId, isScheduleSilenceActive(chatId));
    }
  }
}

export async function announceIfOverallSilenceChanged(
  bot: Bot,
  chatId: number,
  wasOverallActive: boolean,
): Promise<void> {
  const isOverallActive = isSilenceActive(chatId);
  if (wasOverallActive === isOverallActive) return;

  try {
    await announceChatStatus(bot, chatId);
  } catch (err) {
    log.error('failed to announce silence change', { err, chatId });
  }
}

export async function applyScheduleConfigChange(
  bot: Bot,
  chatId: number,
  wasOverallActive: boolean,
): Promise<void> {
  const settings = getSilenceSettings(chatId);

  if (!settings.scheduleEnabled) {
    setScheduleLastInWindow(chatId, null);
  } else {
    if (isScheduleSilenceActive(chatId)) {
      releaseManualSilenceForSchedule(chatId);
    }
    setScheduleLastInWindow(chatId, isScheduleSilenceActive(chatId));
  }

  await announceIfOverallSilenceChanged(bot, chatId, wasOverallActive);
}

export async function checkScheduledTransitions(bot: Bot): Promise<void> {
  for (const chatId of listScheduledChatIds()) {
    const inWindow = isScheduleSilenceActive(chatId);
    const lastInWindow = getScheduleLastInWindow(chatId);

    if (lastInWindow === null) {
      if (inWindow) {
        releaseManualSilenceForSchedule(chatId);
      }
      setScheduleLastInWindow(chatId, inWindow);
      continue;
    }

    if (lastInWindow === inWindow) continue;

    const wasOverallActive = isSilenceActive(chatId);

    if (inWindow) {
      releaseManualSilenceForSchedule(chatId);
    }

    setScheduleLastInWindow(chatId, inWindow);

    if (inWindow) {
      try {
        await announceChatStatus(bot, chatId);
      } catch (err) {
        log.error('failed to announce schedule silence start', { err, chatId });
      }
      continue;
    }

    await announceIfOverallSilenceChanged(bot, chatId, wasOverallActive);
  }
}

export function startMinuteScheduleWatcher(bot: Bot): void {
  initScheduleTracking();

  const run = async () => {
    await checkScheduledTransitions(bot);
    const now = new Date();
    const msUntilNextMinute =
      (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 50;

    setTimeout(run, Math.max(msUntilNextMinute, 1000));
  };

  void run();
}
