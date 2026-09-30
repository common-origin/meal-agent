import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  mondayOfWeekISO,
  thisWeekMondayISO,
  nextWeekMondayISO,
  getPlanWeek,
  setPlanWeek,
  planWeekMondayISO,
  formatWeekRange,
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

describe('plan week selection', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to next week', () => {
    expect(getPlanWeek()).toBe('next');
  });

  it('persists the chosen week', () => {
    setPlanWeek('this');
    expect(getPlanWeek()).toBe('this');
    setPlanWeek('next');
    expect(getPlanWeek()).toBe('next');
  });

  it('resolves the choice to a Monday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T09:00:00'));
    expect(planWeekMondayISO('this')).toBe('2026-09-28');
    expect(planWeekMondayISO('next')).toBe('2026-10-05');
    vi.useRealTimers();
  });
});

describe('formatWeekRange', () => {
  it('formats Monday to Sunday', () => {
    expect(formatWeekRange('2026-09-28')).toBe('Mon 28 Sep – Sun 4 Oct');
  });
});
