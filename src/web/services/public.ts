import { createRequire } from 'node:module';
import { listChats } from '../../db/chats.js';
import { getDb } from '../../db/index.js';
import { isSilenceActive } from '../../modules/silence/service.js';
import { formatUptime } from '../../utils/uptime.js';

const require = createRequire(import.meta.url);
const appVersion = require('../../../package.json').version as string;

function countRows(sql: string): number {
  const row = getDb().prepare(sql).get() as { count: number };
  return row.count;
}

export type PublicStatusDto = {
  status: 'ok';
  version: string;
  uptimeSeconds: number;
  uptimeLabel: string;
  checkedAt: number;
  stats: {
    chats: number;
    rssFeeds: number;
    triggers: number;
    autoposts: number;
    silenceActive: number;
  };
};

export function getPublicStatus(): PublicStatusDto {
  const chats = listChats();
  let silenceActive = 0;

  for (const chat of chats) {
    if (isSilenceActive(chat.chatId)) {
      silenceActive++;
    }
  }

  const uptimeSeconds = Math.floor(process.uptime());

  return {
    status: 'ok',
    version: appVersion,
    uptimeSeconds,
    uptimeLabel: formatUptime(uptimeSeconds),
    checkedAt: Date.now(),
    stats: {
      chats: chats.length,
      rssFeeds: countRows('SELECT COUNT(*) AS count FROM rss_feeds WHERE enabled = 1'),
      triggers: countRows('SELECT COUNT(*) AS count FROM triggers WHERE enabled = 1'),
      autoposts: countRows('SELECT COUNT(*) AS count FROM autopost_schedules WHERE enabled = 1'),
      silenceActive,
    },
  };
}
