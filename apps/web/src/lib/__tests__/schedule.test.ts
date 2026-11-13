import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  mondayOfWeekISO,
  thisWeekMondayISO,
  nextWeekMondayISO,
  shiftWeekISO,
  weekToShow,
  weekToOpen,
  defaultPlanningWeekISO,
  formatWeekRange,
  relativeWeekLabel,
  planningWeekOptions,
  parseWeekParam,
  shouldPromptNextWeek,
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

describe('weekToShow (#194)', () => {
  it('finds a plan made on Sunday for the coming week on the Monday', () => {
    // Planned on Sun 8 Nov for the week of Mon 9 Nov
    const planned = ['2026-11-02', '2026-11-09'];
    expect(weekToShow(planned, '2026-11-08T18:00:00')).toBe('2026-11-02');
    expect(weekToShow(planned, '2026-11-09T07:00:00')).toBe('2026-11-09');
    expect(weekToShow(planned, '2026-11-15T20:00:00')).toBe('2026-11-09');
  });

  it("opens the soonest upcoming week when today's week has no plan", () => {
    expect(weekToShow(['2026-11-23', '2026-11-16', '2026-10-26'], '2026-11-10T12:00:00')).toBe('2026-11-16');
  });

  it('ignores past weeks and returns null when nothing is planned ahead', () => {
    expect(weekToShow(['2026-10-26'], '2026-11-10T12:00:00')).toBeNull();
    expect(weekToShow([], '2026-11-10T12:00:00')).toBeNull();
  });
});

describe('weekToOpen (#194)', () => {
  const planned = ['2026-11-09', '2026-11-16'];

  it("opens today's week on Monday to Thursday", () => {
    expect(weekToOpen(planned, '2026-11-12T12:00:00')).toBe('2026-11-09');
  });

  it('opens the week ahead on Friday to Sunday once it is planned', () => {
    expect(weekToOpen(planned, '2026-11-15T18:00:00')).toBe('2026-11-16');
    expect(weekToOpen(planned, '2026-11-13T18:00:00')).toBe('2026-11-16');
  });

  it("falls back to today's week at the weekend when nothing is planned ahead", () => {
    expect(weekToOpen(['2026-11-09'], '2026-11-15T18:00:00')).toBe('2026-11-09');
    expect(weekToOpen([], '2026-11-15T18:00:00')).toBeNull();
  });
});

describe('defaultPlanningWeekISO (#194)', () => {
  it.each(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'])('plans this week on %s (Mon–Thu)', (date) => {
    expect(defaultPlanningWeekISO(`${date}T12:00:00`)).toBe('2026-11-09');
  });

  it.each(['2026-11-13', '2026-11-14', '2026-11-15'])('plans next week on %s (Fri–Sun)', (date) => {
    expect(defaultPlanningWeekISO(`${date}T12:00:00`)).toBe('2026-11-16');
  });
});

describe('shiftWeekISO / formatWeekRange / relativeWeekLabel', () => {
  it('moves by whole weeks, across months and years', () => {
    expect(shiftWeekISO('2026-11-09', 1)).toBe('2026-11-16');
    expect(shiftWeekISO('2026-11-02', -1)).toBe('2026-10-26');
    expect(shiftWeekISO('2026-12-28', 1)).toBe('2027-01-04');
  });

  it('formats the Monday–Sunday range', () => {
    expect(formatWeekRange('2026-11-16')).toBe('Mon 16 – Sun 22 Nov');
    expect(formatWeekRange('2026-10-26')).toBe('Mon 26 Oct – Sun 1 Nov');
  });

  it('labels last, this and next week only', () => {
    const today = '2026-11-13T12:00:00';
    expect(relativeWeekLabel('2026-11-02', today)).toBe('Last week');
    expect(relativeWeekLabel('2026-11-09', today)).toBe('This week');
    expect(relativeWeekLabel('2026-11-16', today)).toBe('Next week');
    expect(relativeWeekLabel('2026-11-23', today)).toBeNull();
  });
});

describe('planningWeekOptions (#194)', () => {
  const today = '2026-11-15T12:00:00'; // Sun, week of 9 Nov

  it('offers this week and the next two', () => {
    expect(planningWeekOptions('2026-11-16', today)).toEqual(['2026-11-09', '2026-11-16', '2026-11-23']);
  });

  it('adds a further-out selected week, but not a past one', () => {
    expect(planningWeekOptions('2026-12-07', today)).toEqual(['2026-11-09', '2026-11-16', '2026-11-23', '2026-12-07']);
    expect(planningWeekOptions('2026-11-02', today)).toEqual(['2026-11-09', '2026-11-16', '2026-11-23']);
  });
});

describe('parseWeekParam (#194)', () => {
  it("returns the date's Monday", () => {
    expect(parseWeekParam('2026-11-16')).toBe('2026-11-16');
    expect(parseWeekParam('2026-11-19')).toBe('2026-11-16');
  });

  it('rejects anything that is not a real YYYY-MM-DD date', () => {
    expect(parseWeekParam(null)).toBeNull();
    expect(parseWeekParam('')).toBeNull();
    expect(parseWeekParam('next-week')).toBeNull();
    expect(parseWeekParam('2026-02-30')).toBeNull();
  });
});

describe('shouldPromptNextWeek (#195)', () => {
  it('prompts on Friday to Sunday when this week is on screen and next week is unplanned', () => {
    expect(shouldPromptNextWeek('2026-11-09', ['2026-11-09'], '2026-11-13T12:00:00')).toBe(true);
    expect(shouldPromptNextWeek('2026-11-09', ['2026-11-09'], '2026-11-15T20:00:00')).toBe(true);
  });

  it('does not prompt Monday to Thursday', () => {
    expect(shouldPromptNextWeek('2026-11-09', ['2026-11-09'], '2026-11-12T12:00:00')).toBe(false);
  });

  it('does not prompt once next week is planned, or for another week on screen', () => {
    expect(shouldPromptNextWeek('2026-11-09', ['2026-11-09', '2026-11-16'], '2026-11-14T12:00:00')).toBe(false);
    expect(shouldPromptNextWeek('2026-11-16', ['2026-11-09'], '2026-11-14T12:00:00')).toBe(false);
  });
});
