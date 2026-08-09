import { getTimezoneOrDefault } from '../silence/schedule.js';
import type { AutopostDto, AutopostRow, AutopostScheduleType } from './types.js';

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatAutopostScheduleLabel(row: {
  schedule_type: AutopostScheduleType;
  weekday: number | null;
  hour: number | null;
  minute: number | null;
  interval_minutes: number | null;
}): string {
  if (row.schedule_type === 'interval' && row.interval_minutes) {
    if (row.interval_minutes % 60 === 0 && row.interval_minutes >= 60) {
      const hours = row.interval_minutes / 60;
      return `Каждые ${hours} ч`;
    }
    return `Каждые ${row.interval_minutes} мин`;
  }

  const time =
    row.hour !== null && row.minute !== null
      ? `${pad2(row.hour)}:${pad2(row.minute)}`
      : '??:??';

  if (row.schedule_type === 'weekly' && row.weekday !== null) {
    return `Каждый ${WEEKDAY_LABELS[row.weekday] ?? '?'} в ${time}`;
  }

  return `Каждый день в ${time}`;
}

export function toAutopostDto(row: AutopostRow): AutopostDto {
  const timezone = getTimezoneOrDefault(row.timezone);
  return {
    id: row.id,
    chatId: row.chat_id,
    title: row.title,
    messageText: row.message_text,
    scheduleType: row.schedule_type,
    weekday: row.weekday,
    hour: row.hour,
    minute: row.minute,
    intervalMinutes: row.interval_minutes,
    timezone,
    enabled: row.enabled === 1,
    lastPostedAt: row.last_posted_at,
    lastPosted: row.last_posted_at
      ? new Date(row.last_posted_at).toLocaleString('ru-RU', { timeZone: timezone })
      : null,
    scheduleLabel: formatAutopostScheduleLabel(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

export function getZonedParts(date: Date, timezone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });

  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  const weekdayMap: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    weekday: weekdayMap[map.weekday ?? 'Mon'] ?? 0,
  };
}

export function shouldPostNow(row: AutopostRow, now = new Date()): boolean {
  if (row.enabled !== 1) return false;

  const timezone = getTimezoneOrDefault(row.timezone);
  const zoned = getZonedParts(now, timezone);

  if (row.schedule_type === 'interval') {
    const interval = row.interval_minutes ?? 0;
    if (interval <= 0) return false;
    if (!row.last_posted_at) return true;
    return now.getTime() - row.last_posted_at >= interval * 60_000;
  }

  if (row.hour !== zoned.hour || row.minute !== zoned.minute) {
    return false;
  }

  if (row.schedule_type === 'weekly') {
    if (row.weekday !== zoned.weekday) return false;
  }

  if (!row.last_posted_at) return true;

  const lastZoned = getZonedParts(new Date(row.last_posted_at), timezone);
  if (row.schedule_type === 'daily') {
    return (
      lastZoned.year !== zoned.year ||
      lastZoned.month !== zoned.month ||
      lastZoned.day !== zoned.day
    );
  }

  return (
    lastZoned.year !== zoned.year ||
    lastZoned.month !== zoned.month ||
    lastZoned.day !== zoned.day ||
    lastZoned.hour !== zoned.hour ||
    lastZoned.minute !== zoned.minute
  );
}
