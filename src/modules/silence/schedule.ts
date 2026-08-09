import { config } from '../../config.js';

export type SilenceSchedule = {
  enabled: boolean;
  startMinutes: number;
  endMinutes: number;
  timezone: string;
  weekendsEnabled: boolean;
};

export const DEFAULT_SCHEDULE_START_MINUTES = 21 * 60;
export const DEFAULT_SCHEDULE_END_MINUTES = 9 * 60;

export function parseTimeToMinutes(input: string): number | null {
  const trimmed = input.trim();

  const hhmm = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (hhmm) {
    const hour = Number(hhmm[1]);
    const minute = Number(hhmm[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return hour * 60 + minute;
  }

  const hourOnly = /^(\d{1,2})$/.exec(trimmed);
  if (hourOnly) {
    const hour = Number(hourOnly[1]);
    if (hour < 0 || hour > 23) return null;
    return hour * 60;
  }

  return null;
}

export function formatMinutesAsTime(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function getTimezoneOrDefault(timezone: string | null | undefined): string {
  return timezone?.trim() || config.timezone;
}

export function getNowMinutesInTimezone(timezone: string, date = new Date()): number {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);

  return hour * 60 + minute;
}

export function getWeekdayInTimezone(timezone: string, date = new Date()): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  });

  const day = formatter.format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return map[day] ?? 0;
}

export function isWeekendInTimezone(timezone: string, date = new Date()): boolean {
  const weekday = getWeekdayInTimezone(timezone, date);
  return weekday === 0 || weekday === 6;
}

export function isWithinDailyTimeWindow(
  schedule: Pick<SilenceSchedule, 'startMinutes' | 'endMinutes' | 'timezone'>,
  date = new Date(),
): boolean {
  const { startMinutes, endMinutes } = schedule;
  if (startMinutes === endMinutes) return false;

  const nowMinutes = getNowMinutesInTimezone(schedule.timezone, date);

  if (startMinutes < endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }

  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

export function isWithinSchedule(schedule: SilenceSchedule, date = new Date()): boolean {
  if (!schedule.enabled) return false;

  if (schedule.weekendsEnabled && isWeekendInTimezone(schedule.timezone, date)) {
    return true;
  }

  return isWithinDailyTimeWindow(schedule, date);
}

export function formatScheduleRange(startMinutes: number, endMinutes: number): string {
  return `${formatMinutesAsTime(startMinutes)}–${formatMinutesAsTime(endMinutes)}`;
}

export function formatScheduleDescription(
  startMinutes: number,
  endMinutes: number,
  weekendsEnabled: boolean,
): string {
  const parts = [formatScheduleRange(startMinutes, endMinutes)];
  if (weekendsEnabled) {
    parts.push('сб–вс');
  }
  return parts.join(', ');
}

export const SCHEDULE_TIME_HINT = 'Введите время в формате ЧЧ:ММ, например 21:00 или 9:00.';
