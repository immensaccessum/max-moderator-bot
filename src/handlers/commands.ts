import type { Bot } from '@maxhub/max-bot-api';

export function registerCommands(bot: Bot): void {
  bot.command('start', async (ctx) => {
    await ctx.reply(
      'Бот-модератор для чатов Max.\n\n' +
        'Добавьте меня в групповой чат — я смогу писать сообщения.\n' +
        'Для модерации (удаление сообщений в тишине) выдайте права администратора.\n\n' +
        'Админы настраивают бота в личке: /settings',
    );
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(
      'Команды:\n' +
        '/start — информация о боте\n' +
        '/help — эта справка\n' +
        '/myid — твой user_id в Max\n' +
        '/ping — проверка задержки бота\n' +
        '/settings — настройки (в личке с ботом)',
    );
  });

  bot.command('myid', async (ctx) => {
    const senderId = ctx.message?.sender?.user_id;
    if (!senderId) {
      await ctx.reply('Не удалось определить твой ID.');
      return;
    }

    await ctx.reply(
      `Твой user_id: ${senderId}\n\n` +
        'Скопируй его в .env как OWNER_ID=..., если нужны отладочные команды.',
    );
  });

}
