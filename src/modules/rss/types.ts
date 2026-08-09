export type RssFeedRow = {
  id: number;
  chat_id: number;
  title: string | null;
  feed_url: string;
  poll_interval_minutes: number;
  include_description: number;
  enabled: number;
  last_item_key: string | null;
  last_checked_at: number | null;
  last_posted_at: number | null;
  last_error: string | null;
  failure_count: number;
  created_at: number;
  updated_at: number;
};

export type RssFeedDto = {
  id: number;
  chatId: number;
  title: string | null;
  feedUrl: string;
  pollIntervalMinutes: number;
  includeDescription: boolean;
  enabled: boolean;
  lastItemKey: string | null;
  lastCheckedAt: number | null;
  lastPostedAt: number | null;
  lastError: string | null;
  failureCount: number;
  maxConsecutiveFailures: number;
  lastChecked: string | null;
  lastPosted: string | null;
  createdAt: number;
  updatedAt: number;
};

export type RssFeedItem = {
  guid?: string;
  link?: string;
  title?: string;
  isoDate?: string;
  contentSnippet?: string;
};
