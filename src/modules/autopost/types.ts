export type AutopostScheduleType = 'weekly' | 'daily' | 'interval';

export type AutopostRow = {
  id: number;
  chat_id: number;
  title: string | null;
  message_text: string;
  schedule_type: AutopostScheduleType;
  weekday: number | null;
  hour: number | null;
  minute: number | null;
  interval_minutes: number | null;
  timezone: string | null;
  enabled: number;
  last_posted_at: number | null;
  created_at: number;
  updated_at: number;
};

export type AutopostDto = {
  id: number;
  chatId: number;
  title: string | null;
  messageText: string;
  scheduleType: AutopostScheduleType;
  weekday: number | null;
  hour: number | null;
  minute: number | null;
  intervalMinutes: number | null;
  timezone: string;
  enabled: boolean;
  lastPostedAt: number | null;
  lastPosted: string | null;
  scheduleLabel: string;
  createdAt: number;
  updatedAt: number;
};
