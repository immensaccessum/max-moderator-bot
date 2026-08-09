import { describe, expect, it } from 'vitest';
import { shouldPostNow } from './schedule.js';
import type { AutopostRow } from './types.js';

function makeRow(overrides: Partial<AutopostRow> = {}): AutopostRow {
  return {
    id: 1,
    chat_id: -1,
    title: null,
    message_text: 'test',
    schedule_type: 'daily',
    weekday: null,
    hour: 10,
    minute: 0,
    interval_minutes: null,
    timezone: 'UTC',
    enabled: 1,
    last_posted_at: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  };
}

describe('shouldPostNow', () => {
  it('posts on first interval run', () => {
    const row = makeRow({
      schedule_type: 'interval',
      interval_minutes: 30,
      hour: null,
      minute: null,
      last_posted_at: null,
    });

    expect(shouldPostNow(row, new Date('2026-01-01T12:00:00Z'))).toBe(true);
  });

  it('waits until interval elapsed', () => {
    const now = new Date('2026-01-01T12:30:00Z');
    const row = makeRow({
      schedule_type: 'interval',
      interval_minutes: 30,
      hour: null,
      minute: null,
      last_posted_at: now.getTime() - 10 * 60_000,
    });

    expect(shouldPostNow(row, now)).toBe(false);
  });

  it('posts daily at configured time once per day', () => {
    const first = new Date('2026-01-01T10:00:00Z');
    const row = makeRow({ hour: 10, minute: 0, timezone: 'UTC' });

    expect(shouldPostNow(row, first)).toBe(true);

    const sameDay = new Date('2026-01-01T10:05:00Z');
    row.last_posted_at = first.getTime();
    expect(shouldPostNow(row, sameDay)).toBe(false);

    const nextDay = new Date('2026-01-02T10:00:00Z');
    expect(shouldPostNow(row, nextDay)).toBe(true);
  });
});
