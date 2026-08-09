# Max Moderator Bot

Бот-модератор для групповых чатов Max: тишина, триггеры, автопостинг, лог удалений и веб-админка (mini-app).

## Требования

- Node.js 18.18+
- npm

## Локальный запуск

```bash
cp .env.example .env
# заполнить BOT_TOKEN и при необходимости WEB_ADMIN_TOKEN

npm install
npm run dev
```

Веб-админка: `http://127.0.0.1:3000` (если `WEB_ENABLED=true`).

## Скрипты

| Команда | Описание |
|---|---|
| `npm run dev` | Запуск в watch-режиме |
| `npm run build` | Сборка TypeScript |
| `npm run start` | Запуск `dist/index.js` |
| `npm test` | Unit-тесты (vitest) |
| `npm run lint` | ESLint |
| `bash scripts/deploy.sh` | Деплой на сервер по SSH |

## Структура

```
src/modules/<name>/     — бот-логика (handlers, store, service, watcher)
src/web/routes|services — HTTP API админки
admin/public/js/modules — вкладки веб-админки
```

Каждая новая фича добавляется симметрично во все три слоя.

## Переменные окружения

| Переменная | Описание |
|---|---|
| `BOT_TOKEN` | Токен бота из Master Bot |
| `OWNER_ID` | ID владельца (опционально) |
| `DB_PATH` | Путь к SQLite (по умолчанию `./data/bot.db`) |
| `WEB_ENABLED` | Включить веб-админку (`true`) |
| `WEB_PORT` | Порт веб-сервера |
| `WEB_PUBLIC_URL` | Публичный URL админки |
| `WEB_ADMIN_TOKEN` | Токен для входа в браузере |
| `LOG_LEVEL` | `debug` / `info` / `warn` / `error` |
| `TZ` | Часовой пояс расписаний |

## Деплой

1. Скопировать шаблон: `cp .env.deploy.example .env.deploy`
2. Заполнить хост, домен, путь на сервере
3. Запустить: `bash scripts/deploy.sh`

Переменные деплоя описаны в `.env.deploy.example`.

Локальная база на сервер **не** заливается по умолчанию. Для принудительной заливки: `DEPLOY_DB=1 bash scripts/deploy.sh`.

### TLS для Max API

`platform-api2.max.ru` использует сертификат Минцифры. На новом сервере один раз:

```bash
bash scripts/install-max-ca-certs.sh
```

PM2 задаёт `NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt` в `ecosystem.config.cjs`.

## Бэкап базы

На сервере:

```bash
BACKUP_DIR=/var/backups/max-moderator-bot bash scripts/backup-db.sh
```

Рекомендуется cron (пример): `0 3 * * * BACKUP_DIR=/var/backups/max-moderator-bot /opt/max-moderator-bot/scripts/backup-db.sh`
