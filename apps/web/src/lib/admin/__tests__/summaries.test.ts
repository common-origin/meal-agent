import { describe, it, expect } from 'vitest';
import { aiProblems, cycleSentence, databaseSummary } from '../summaries';
import type { WeeklyCycle } from '../types';

const cycle = (over: Partial<WeeklyCycle> = {}, funnel: WeeklyCycle['events']['funnel'] = [], available = true): WeeklyCycle => ({
  first_week: '2026-09-28',
  last_week: '2026-11-16',
  households_total: 2,
  weeks: [
    { week_start: '2026-11-09', composed: 1, recipes_ai: 0, recipes_imported: 0, recipes_user_added: 0 },
    { week_start: '2026-11-16', composed: 1, recipes_ai: 0, recipes_imported: 0, recipes_user_added: 0 },
  ],
  cuisines: { households: 0, avg: null, max: null },
  events: { available, funnel, swaps: {}, edits: {}, ratings: { count: 0, avg: null, by_star: {} }, counts: {} },
  ...over,
});

describe('cycleSentence (#270)', () => {
  it('describes the newest week step by step, whatever order the weeks arrive in', () => {
    const text = cycleSentence(cycle({}, [{ week_start: '2026-11-16', type: 'plan_confirmed', households: 1 }, { week_start: '2026-11-09', type: 'plan_confirmed', households: 0 }]));
    expect(text).toBe('Week of 16 Nov: of 2 households, 1 composed a plan, 1 confirmed it, 0 built a shopping list, 0 sent it to Coles and 0 finished shopping.');
  });

  it('says so when nobody composed a plan that week, or there are no weeks', () => {
    expect(cycleSentence(cycle({ weeks: [{ week_start: '2026-11-16', composed: 0, recipes_ai: 0, recipes_imported: 0, recipes_user_added: 0 }] }))).toBe('Week of 16 Nov: no household has composed a plan yet.');
    expect(cycleSentence(cycle({ weeks: [] }))).toBe('No weekly plans have been composed yet.');
  });

  it('stops at composing when product events are unavailable, instead of printing a row of zeros', () => {
    expect(cycleSentence(cycle({ households_total: 1 }, [], false))).toBe('Week of 16 Nov: of 1 household, 1 composed a plan.');
  });
});

describe('aiProblems (#270)', () => {
  it('lists failed statuses and error codes, or None', () => {
    expect(aiProblems({ statuses: { ok: 18, error: 2 }, top_errors: [{ code: 'http_503', count: 2 }] })).toBe('error 2, http_503 ×2');
    expect(aiProblems({ statuses: { ok: 5 }, top_errors: [] })).toBe('None');
  });
});

describe('databaseSummary (#270)', () => {
  const schema = (applied: boolean[]) => applied.map((a, i) => ({ migration: String(19 + i).padStart(3, '0'), name: 'x', applied: a }));
  const stat = (table: string, rows: number, dead_ratio: number, size_bytes = 1000) => ({ table, rows, dead_rows: 0, dead_ratio, size_bytes });

  it('collapses fully applied migrations to one line', () => {
    expect(databaseSummary([], schema([true, true, true])).migrations).toBe('Migrations 019 to 021: all 3 applied.');
  });

  it('names only the missing ones', () => {
    const summary = databaseSummary([], schema([true, false, false]));
    expect(summary.missing).toEqual(['020', '021']);
    expect(summary.migrations).toBe('Migrations 019 to 021: 020, 021 are missing.');
    expect(databaseSummary([], schema([false])).migrations).toBe('Migrations 019 to 019: 019 is missing.');
  });

  it('says so when there is no schema check', () => {
    expect(databaseSummary([], []).migrations).toBe('No migration check available.');
  });

  it('totals the tables and flags only big, mostly dead ones', () => {
    const summary = databaseSummary([stat('big', 5000, 0.5, 2000), stat('tiny', 2, 0.9, 500), stat('clean', 5000, 0.01, 100)], []);
    expect(summary).toMatchObject({ tables: 3, totalBytes: 2600, needVacuum: ['big'] });
  });
});
