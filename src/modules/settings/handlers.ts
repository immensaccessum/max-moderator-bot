import type { Bot } from '@maxhub/max-bot-api';
import { ensureChat } from '../../db/chats.js';
import { deleteAndRecord, formatSenderLabel } from '../deletion-log/service.js';
import { isUserChatAdmin, requireChatAdminFor } from '../../utils/admin.js';
import type { BotContext } from '../../types.js';
import { getSenderId, isGroupMessage } from '../../utils/chat.js';
import {
  announceChatStatus,
  enableSilenceForever,
  enableSilenceForMinutes,
  isManualSilenceBlocked,
  isManualSilenceActive,
  isSilenceActive,
  turnOffSilence,
} from '../silence/service.js';
import { parseCustomDurationInput } from '../silence/constants.js';
import { parseTimeToMinutes } from '../silence/schedule.js';
import { applyScheduleConfigChange } from '../silence/schedule-watcher.js';
import {
  getSilenceSettings,
  updateSilenceMessages,
  updateSilenceSchedule,
} from '../silence/store.js';
import { getAdminChats } from './chats.js';
import {
  buildChatPickerKeyboard,
  buildChatPickerText,
  buildSettingsKeyboard,
  buildSettingsText,
} from './keyboard.js';
import {
  clearPendingInput,
  getPendingPrompt,
  setPendingInput,
  takePendingInput,
} from './pending.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('settings');

function parseTargetChatId(payload: string): number | undefined {
  const id = Number(payload);
  if (!Number.isSafeInteger(id) || id === 0) return undefined;
  return id;
}

async function applySilenceChange(
  bot: Bot,
  targetChatId: number,
  action: () => void,
): Promise<void> {
  const before = isSilenceActive(targetChatId);
  action();
  const after = isSilenceActive(targetChatId);

  if (before === after) return;

  try {
    await announceChatStatus(bot, targetChatId);
  } catch (err) {
    log.error('failed to announce silence change', { err, chatId: targetChatId });
  }
}

async function sendSettingsToUser(
  ctx: BotContext,
  userId: number,
  targetChatId: number,
  chatTitle?: string | null,
): Promise<void> {
  await ctx.api.sendMessageToUser(userId, buildSettingsText(targetChatId, chatTitle), {
    attachments: [buildSettingsKeyboard(targetChatId)],
  });
}

async function refreshSettingsMessage(
  ctx: BotContext,
  targetChatId: number,
  chatTitle?: string | null,
): Promise<void> {
  if (!ctx.messageId) return;

  await ctx.editMessage({
    text: buildSettingsText(targetChatId, chatTitle),
    attachments: [buildSettingsKeyboard(targetChatId)],
  });
}

async function sendChatPicker(ctx: BotContext, userId: number): Promise<void> {
  const chats = await getAdminChats(ctx, userId);

  if (chats.length === 0) {
    await ctx.api.sendMessageToUser(
      userId,
      'Нет групповых чатов, где вы админ и добавлен этот бот.',
    );
    return;
  }

  if (chats.length === 1) {
    const chat = chats[0];
    ensureChat(chat.chat_id, chat.title);
    await sendSettingsToUser(ctx, userId, chat.chat_id, chat.title);
    return;
  }

  await ctx.api.sendMessageToUser(userId, buildChatPickerText(), {
    attachments: [buildChatPickerKeyboard(chats)],
  });
}

export function registerSettingsHandlers(bot: Bot): void {
  bot.command('settings', async (ctx) => {
    const senderId = getSenderId(ctx);
    if (!senderId) return;

    if (isGroupMessage(ctx) && ctx.chatId) {
      if (!(await isUserChatAdmin(ctx, senderId, ctx.chatId))) {
        await ctx.api.sendMessageToUser(
          senderId,
          'У вас нет прав администратора в этом чате.',
        );
        return;
      }

      ensureChat(ctx.chatId);
      const chat = await ctx.getChat(ctx.chatId);
      await sendSettingsToUser(ctx, senderId, ctx.chatId, chat.title);

      if (ctx.messageId) {
        const sender = ctx.message?.sender;
        await deleteAndRecord(
          () => ctx.deleteMessage(ctx.messageId!),
          {
            chatId: ctx.chatId,
            messageId: ctx.messageId,
            userId: sender?.user_id,
            userLabel: formatSenderLabel(sender),
            messageText: ctx.message?.body?.text ?? null,
            source: 'settings',
            sourceDetail: 'Команда /settings в групповом чате',
            eventType: 'message_created',
          },
        );
      }
      return;
    }

    await sendChatPicker(ctx, senderId);
  });

  bot.on('message_created', async (ctx, next) => {
    if (isGroupMessage(ctx)) {
      return next();
    }

    const senderId = getSenderId(ctx);
    const text = ctx.message?.body?.text?.trim();
    if (!senderId || !text) {
      return next();
    }

    const pending = takePendingInput(senderId);
    if (!pending) {
      return next();
    }

    if (text.toLowerCase() === 'отмена') {
      await ctx.reply('Отменено.');
      return;
    }

    if (!(await requireChatAdminFor(ctx, pending.chatId, senderId))) {
      await ctx.reply('Недостаточно прав для этого чата.');
      return;
    }

    const chat = await ctx.getChat(pending.chatId);

    if (pending.type === 'duration') {
      if (isManualSilenceBlocked(pending.chatId)) {
        await ctx.reply('Ручная тишина недоступна: чат сейчас закрыт.');
        return;
      }

      if (text === '-') {
        await ctx.reply('Отменено.');
        await sendSettingsToUser(ctx, senderId, pending.chatId, chat.title);
        return;
      }

      const parsed = parseCustomDurationInput(text);
      if (parsed === null && !/^(forever|постоянно|∞)$/i.test(text)) {
        await ctx.reply('Не понял длительность. Пример: 45, 2h, 1d или «постоянно».');
        setPendingInput(senderId, pending);
        return;
      }

      try {
        await applySilenceChange(bot, pending.chatId, () => {
          if (parsed === null) {
            enableSilenceForever(pending.chatId);
          } else {
            enableSilenceForMinutes(pending.chatId, parsed);
          }
        });
      } catch {
        await ctx.reply('Ручная тишина недоступна: чат сейчас закрыт.');
        return;
      }

      await sendSettingsToUser(ctx, senderId, pending.chatId, chat.title);
      return;
    }

    if (pending.type === 'scheduleStart' || pending.type === 'scheduleEnd') {
      if (text === '-') {
        await ctx.reply('Отменено.');
        await sendSettingsToUser(ctx, senderId, pending.chatId, chat.title);
        return;
      }

      const minutes = parseTimeToMinutes(text);
      if (minutes === null) {
        await ctx.reply('Не понял время. Пример: 21:00 или 9:00');
        setPendingInput(senderId, pending);
        return;
      }

      const before = isSilenceActive(pending.chatId);
      updateSilenceSchedule(pending.chatId, {
        ...(pending.type === 'scheduleStart'
          ? { startMinutes: minutes }
          : { endMinutes: minutes }),
      });
      await applyScheduleConfigChange(bot, pending.chatId, before);

      await ctx.reply('Расписание обновлено.');
      await sendSettingsToUser(ctx, senderId, pending.chatId, chat.title);
      return;
    }

    const suffixValue = text === '-' ? null : text;
    updateSilenceMessages(pending.chatId, {
      ...(pending.type === 'openSuffix'
        ? { openSuffix: suffixValue }
        : { closedSuffix: suffixValue }),
    });

    await ctx.reply('Приписка сохранена.');
    await sendSettingsToUser(ctx, senderId, pending.chatId, chat.title);
  });

  bot.action('settings:list', async (ctx) => {
    const userId = ctx.callback?.user.user_id;
    if (!userId) return;

    clearPendingInput(userId);

    const chats = await getAdminChats(ctx, userId);
    if (chats.length === 0) {
      await ctx.answerOnCallback({ notification: 'Нет доступных чатов' });
      return;
    }

    await ctx.answerOnCallback({ notification: 'Список чатов' });

    if (ctx.messageId) {
      await ctx.editMessage({
        text: buildChatPickerText(),
        attachments: [buildChatPickerKeyboard(chats)],
      });
    }
  });

  bot.action(/^settings:chat:(-?\d+)$/, async (ctx) => {
    const targetChatId = parseTargetChatId(ctx.match![1]);
    const userId = ctx.callback?.user.user_id;
    if (!targetChatId || !userId) return;

    clearPendingInput(userId);

    if (!(await requireChatAdminFor(ctx, targetChatId, userId))) {
      await ctx.answerOnCallback({ notification: 'Недостаточно прав' });
      return;
    }

    ensureChat(targetChatId);
    const chat = await ctx.getChat(targetChatId);

    await ctx.answerOnCallback({ notification: 'Настройки чата' });

    if (ctx.messageId) {
      await ctx.editMessage({
        text: buildSettingsText(targetChatId, chat.title),
        attachments: [buildSettingsKeyboard(targetChatId)],
      });
    }
  });

  bot.action(/^silence:mins:(\d+):(-?\d+)$/, async (ctx) => {
    const minutes = Number(ctx.match![1]);
    const targetChatId = parseTargetChatId(ctx.match![2]);
    const userId = ctx.callback?.user.user_id;
    if (!targetChatId || !userId || !Number.isInteger(minutes) || minutes <= 0) return;

    if (!(await requireChatAdminFor(ctx, targetChatId, userId))) {
      await ctx.answerOnCallback({ notification: 'Недостаточно прав' });
      return;
    }

    if (isManualSilenceBlocked(targetChatId)) {
      await ctx.answerOnCallback({ notification: 'Чат сейчас закрыт' });
      return;
    }

    ensureChat(targetChatId);
    const chat = await ctx.getChat(targetChatId);

    try {
      await applySilenceChange(bot, targetChatId, () => {
        enableSilenceForMinutes(targetChatId, minutes);
      });
    } catch {
      await ctx.answerOnCallback({ notification: 'Ручная тишина недоступна' });
      return;
    }

    await ctx.answerOnCallback({ notification: `Тишина: ${minutes} мин.` });
    await refreshSettingsMessage(ctx, targetChatId, chat.title);
  });

  bot.action(/^silence:forever:(-?\d+)$/, async (ctx) => {
    const targetChatId = parseTargetChatId(ctx.match![1]);
    const userId = ctx.callback?.user.user_id;
    if (!targetChatId || !userId) return;

    if (!(await requireChatAdminFor(ctx, targetChatId, userId))) {
      await ctx.answerOnCallback({ notification: 'Недостаточно прав' });
      return;
    }

    if (isManualSilenceBlocked(targetChatId)) {
      await ctx.answerOnCallback({ notification: 'Чат сейчас закрыт' });
      return;
    }

    ensureChat(targetChatId);
    const chat = await ctx.getChat(targetChatId);

    try {
      await applySilenceChange(bot, targetChatId, () => {
        enableSilenceForever(targetChatId);
      });
    } catch {
      await ctx.answerOnCallback({ notification: 'Ручная тишина недоступна' });
      return;
    }

    await ctx.answerOnCallback({ notification: 'Тишина: постоянно' });
    await refreshSettingsMessage(ctx, targetChatId, chat.title);
  });

  bot.action(/^silence:off:(-?\d+)$/, async (ctx) => {
    const targetChatId = parseTargetChatId(ctx.match![1]);
    const userId = ctx.callback?.user.user_id;
    if (!targetChatId || !userId) return;

    if (!(await requireChatAdminFor(ctx, targetChatId, userId))) {
      await ctx.answerOnCallback({ notification: 'Недостаточно прав' });
      return;
    }

    ensureChat(targetChatId);
    const chat = await ctx.getChat(targetChatId);

    await applySilenceChange(bot, targetChatId, () => {
      turnOffSilence(targetChatId);
    });

    await ctx.answerOnCallback({ notification: 'Тишина выключена' });
    await refreshSettingsMessage(ctx, targetChatId, chat.title);
  });

  bot.action(/^silence:custom:(-?\d+)$/, async (ctx) => {
    const targetChatId = parseTargetChatId(ctx.match![1]);
    const userId = ctx.callback?.user.user_id;
    if (!targetChatId || !userId) return;

    if (!(await requireChatAdminFor(ctx, targetChatId, userId))) {
      await ctx.answerOnCallback({ notification: 'Недостаточно прав' });
      return;
    }

    if (isManualSilenceBlocked(targetChatId)) {
      await ctx.answerOnCallback({ notification: 'Чат сейчас закрыт' });
      return;
    }

    setPendingInput(userId, { type: 'duration', chatId: targetChatId });
    await ctx.answerOnCallback({ notification: 'Введите время' });
    await ctx.api.sendMessageToUser(userId, getPendingPrompt({ type: 'duration', chatId: targetChatId }));
  });

  bot.action(/^silence:edit:(open|closed):(-?\d+)$/, async (ctx) => {
    const field = ctx.match![1] === 'open' ? 'openSuffix' : 'closedSuffix';
    const targetChatId = parseTargetChatId(ctx.match![2]);
    const userId = ctx.callback?.user.user_id;
    if (!targetChatId || !userId) return;

    if (!(await requireChatAdminFor(ctx, targetChatId, userId))) {
      await ctx.answerOnCallback({ notification: 'Недостаточно прав' });
      return;
    }

    setPendingInput(userId, { type: field, chatId: targetChatId });
    await ctx.answerOnCallback({ notification: 'Введите текст' });
    await ctx.api.sendMessageToUser(userId, getPendingPrompt({ type: field, chatId: targetChatId }));
  });

  bot.action(/^schedule:toggle:(-?\d+)$/, async (ctx) => {
    const targetChatId = parseTargetChatId(ctx.match![1]);
    const userId = ctx.callback?.user.user_id;
    if (!targetChatId || !userId) return;

    if (!(await requireChatAdminFor(ctx, targetChatId, userId))) {
      await ctx.answerOnCallback({ notification: 'Недостаточно прав' });
      return;
    }

    ensureChat(targetChatId);
    const chat = await ctx.getChat(targetChatId);
    const settings = getSilenceSettings(targetChatId);

    if (!settings.scheduleEnabled && isManualSilenceActive(targetChatId)) {
      await ctx.answerOnCallback({ notification: 'Сначала выключите ручную тишину' });
      return;
    }

    const before = isSilenceActive(targetChatId);

    try {
      updateSilenceSchedule(targetChatId, { enabled: !settings.scheduleEnabled });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === 'SCHEDULE_BLOCKED_BY_MANUAL') {
        await ctx.answerOnCallback({ notification: 'Сначала выключите ручную тишину' });
        return;
      }
      throw err;
    }

    await applyScheduleConfigChange(bot, targetChatId, before);

    await ctx.answerOnCallback({
      notification: settings.scheduleEnabled ? 'Расписание выкл' : 'Расписание вкл',
    });
    await refreshSettingsMessage(ctx, targetChatId, chat.title);
  });

  bot.action(/^schedule:weekends:(-?\d+)$/, async (ctx) => {
    const targetChatId = parseTargetChatId(ctx.match![1]);
    const userId = ctx.callback?.user.user_id;
    if (!targetChatId || !userId) return;

    if (!(await requireChatAdminFor(ctx, targetChatId, userId))) {
      await ctx.answerOnCallback({ notification: 'Недостаточно прав' });
      return;
    }

    ensureChat(targetChatId);
    const chat = await ctx.getChat(targetChatId);
    const settings = getSilenceSettings(targetChatId);

    if (!settings.scheduleEnabled) {
      await ctx.answerOnCallback({ notification: 'Сначала включите расписание' });
      return;
    }

    const before = isSilenceActive(targetChatId);
    updateSilenceSchedule(targetChatId, {
      weekendsEnabled: !settings.scheduleWeekendsEnabled,
    });
    await applyScheduleConfigChange(bot, targetChatId, before);

    await ctx.answerOnCallback({
      notification: settings.scheduleWeekendsEnabled ? 'Выходные выкл' : 'Выходные вкл',
    });
    await refreshSettingsMessage(ctx, targetChatId, chat.title);
  });

  bot.action(/^schedule:start:(-?\d+)$/, async (ctx) => {
    const targetChatId = parseTargetChatId(ctx.match![1]);
    const userId = ctx.callback?.user.user_id;
    if (!targetChatId || !userId) return;

    if (!(await requireChatAdminFor(ctx, targetChatId, userId))) {
      await ctx.answerOnCallback({ notification: 'Недостаточно прав' });
      return;
    }

    setPendingInput(userId, { type: 'scheduleStart', chatId: targetChatId });
    await ctx.answerOnCallback({ notification: 'Введите время' });
    await ctx.api.sendMessageToUser(
      userId,
      getPendingPrompt({ type: 'scheduleStart', chatId: targetChatId }),
    );
  });

  bot.action(/^schedule:end:(-?\d+)$/, async (ctx) => {
    const targetChatId = parseTargetChatId(ctx.match![1]);
    const userId = ctx.callback?.user.user_id;
    if (!targetChatId || !userId) return;

    if (!(await requireChatAdminFor(ctx, targetChatId, userId))) {
      await ctx.answerOnCallback({ notification: 'Недостаточно прав' });
      return;
    }

    setPendingInput(userId, { type: 'scheduleEnd', chatId: targetChatId });
    await ctx.answerOnCallback({ notification: 'Введите время' });
    await ctx.api.sendMessageToUser(
      userId,
      getPendingPrompt({ type: 'scheduleEnd', chatId: targetChatId }),
    );
  });

  bot.action(/^settings:refresh:(-?\d+)$/, async (ctx) => {
    const targetChatId = parseTargetChatId(ctx.match![1]);
    const userId = ctx.callback?.user.user_id;
    if (!targetChatId || !userId) return;

    if (!(await requireChatAdminFor(ctx, targetChatId, userId))) {
      await ctx.answerOnCallback({ notification: 'Недостаточно прав' });
      return;
    }

    const chat = await ctx.getChat(targetChatId);
    await ctx.answerOnCallback({ notification: 'Обновлено' });
    await refreshSettingsMessage(ctx, targetChatId, chat.title);
  });
}
