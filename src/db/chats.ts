import { getDb } from './index.js';

export type ChatRecord = {
  chatId: number;
  title: string | null;
  createdAt: number;
  updatedAt: number;
};

function rowToChat(row: {
  chat_id: number;
  title: string | null;
  created_at: number;
  updated_at: number;
}): ChatRecord {
  return {
    chatId: row.chat_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function ensureChat(chatId: number, title?: string | null): void {
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO chats (chat_id, title, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(chat_id) DO UPDATE SET
         title = COALESCE(excluded.title, chats.title),
         updated_at = excluded.updated_at`,
    )
    .run(chatId, title ?? null, now, now);
}

export function listChats(): ChatRecord[] {
  const rows = getDb()
    .prepare(
      `SELECT chat_id, title, created_at, updated_at
       FROM chats
       ORDER BY title COLLATE NOCASE, chat_id`,
    )
    .all() as Array<{
    chat_id: number;
    title: string | null;
    created_at: number;
    updated_at: number;
  }>;

  return rows.map(rowToChat);
}

export function getChat(chatId: number): ChatRecord | null {
  const row = getDb()
    .prepare(
      `SELECT chat_id, title, created_at, updated_at
       FROM chats
       WHERE chat_id = ?`,
    )
    .get(chatId) as
    | {
        chat_id: number;
        title: string | null;
        created_at: number;
        updated_at: number;
      }
    | undefined;

  return row ? rowToChat(row) : null;
}
