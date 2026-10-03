import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  mondayOfWeekISO,
  thisWeekMondayISO,
  nextWeekMondayISO,
} from '../schedule';

// Week of Mon 28 Sep – Sun 4 Oct 2026
const WEEK = [
  '2026-09-28', // Mon
  '2026-09-29',
  '2026-09-30',
  '2026-10-01',
  '2026-10-02',
  '2026-10-03',
  '2026-10-04', // Sun
];

describe('mondayOfWeekISO', () => {
  it.each(WEEK)('maps %s to Monday 28 Sep', (date) => {
    expect(mondayOfWeekISO(`${date}T12:00:00`)).toBe('2026-09-28');
  });

  it('treats Sunday as the end of the week, not the start', () => {
    expect(mondayOfWeekISO('2026-10-04T23:59:00')).toBe('2026-09-28');
    expect(mondayOfWeekISO('2026-10-05T00:00:00')).toBe('2026-10-05');
  });
});

describe('thisWeekMondayISO / nextWeekMondayISO', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(WEEK)('on %s returns 28 Sep and 5 Oct', (date) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${date}T09:00:00`));
    expect(thisWeekMondayISO()).toBe('2026-09-28');
    expect(nextWeekMondayISO()).toBe('2026-10-05');
  });
});
