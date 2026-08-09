export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chats (
  chat_id INTEGER PRIMARY KEY,
  title TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS silence_settings (
  chat_id INTEGER PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  until_ms INTEGER,
  open_suffix TEXT,
  closed_suffix TEXT,
  duration_presets TEXT,
  schedule_enabled INTEGER NOT NULL DEFAULT 0,
  schedule_start_minutes INTEGER NOT NULL DEFAULT 1260,
  schedule_end_minutes INTEGER NOT NULL DEFAULT 540,
  schedule_timezone TEXT,
  schedule_weekends_enabled INTEGER NOT NULL DEFAULT 0,
  schedule_last_in_window INTEGER,
  status_message_id TEXT,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (chat_id) REFERENCES chats(chat_id)
);

CREATE TABLE IF NOT EXISTS triggers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  key_phrase TEXT NOT NULL,
  response_text TEXT NOT NULL DEFAULT '',
  match_type TEXT NOT NULL DEFAULT 'contains',
  action TEXT NOT NULL DEFAULT 'reply',
  case_sensitive INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  auto_delete_reply INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (chat_id) REFERENCES chats(chat_id)
);

CREATE INDEX IF NOT EXISTS idx_triggers_chat_id ON triggers(chat_id);

CREATE TABLE IF NOT EXISTS autopost_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  title TEXT,
  message_text TEXT NOT NULL,
  schedule_type TEXT NOT NULL,
  weekday INTEGER,
  hour INTEGER,
  minute INTEGER,
  interval_minutes INTEGER,
  timezone TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_posted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (chat_id) REFERENCES chats(chat_id)
);

CREATE INDEX IF NOT EXISTS idx_autopost_chat_id ON autopost_schedules(chat_id);

CREATE TABLE IF NOT EXISTS deletion_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  message_id TEXT,
  user_id INTEGER,
  user_label TEXT,
  message_text TEXT,
  source TEXT NOT NULL,
  source_detail TEXT,
  event_type TEXT NOT NULL DEFAULT 'message_created',
  success INTEGER NOT NULL DEFAULT 1,
  error_message TEXT,
  deleted_at INTEGER NOT NULL,
  FOREIGN KEY (chat_id) REFERENCES chats(chat_id)
);

CREATE INDEX IF NOT EXISTS idx_deletion_logs_chat_deleted ON deletion_logs(chat_id, deleted_at);

CREATE TABLE IF NOT EXISTS scheduled_deletions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  message_id TEXT NOT NULL,
  message_text TEXT,
  source TEXT NOT NULL,
  source_detail TEXT,
  due_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (chat_id) REFERENCES chats(chat_id)
);

CREATE INDEX IF NOT EXISTS idx_scheduled_deletions_due ON scheduled_deletions(due_at);

CREATE TABLE IF NOT EXISTS rss_feeds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  title TEXT,
  feed_url TEXT NOT NULL,
  poll_interval_minutes INTEGER NOT NULL DEFAULT 15,
  include_description INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_item_key TEXT,
  last_checked_at INTEGER,
  last_posted_at INTEGER,
  last_error TEXT,
  failure_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (chat_id) REFERENCES chats(chat_id)
);

CREATE INDEX IF NOT EXISTS idx_rss_feeds_chat_id ON rss_feeds(chat_id);
`;
