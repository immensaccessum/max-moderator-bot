import { describe, expect, it } from 'vitest';
import { isWithinSchedule, parseTimeToMinutes } from './schedule.js';

describe('silence schedule helpers', () => {
  it('parses HH:MM and hour-only values', () => {
    expect(parseTimeToMinutes('21:30')).toBe(21 * 60 + 30);
    expect(parseTimeToMinutes('9')).toBe(9 * 60);
    expect(parseTimeToMinutes('25:00')).toBeNull();
  });

  it('detects overnight schedule window', () => {
    const schedule = {
      enabled: true,
      startMinutes: 22 * 60,
      endMinutes: 8 * 60,
      timezone: 'UTC',
      weekendsEnabled: false,
    };

    expect(
      isWithinSchedule(schedule, new Date('2026-01-01T23:00:00Z')),
    ).toBe(true);
    expect(
      isWithinSchedule(schedule, new Date('2026-01-01T12:00:00Z')),
    ).toBe(false);
    expect(
      isWithinSchedule(schedule, new Date('2026-01-02T07:00:00Z')),
    ).toBe(true);
  });
});
