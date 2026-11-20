import { describe, it, expect } from 'vitest';
import { aiProblems, databaseSummary, weekSteps, weeklyFunnel } from '../summaries';
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

describe('weeklyFunnel (#286)', () => {
  it('is the newest week, step by step, whatever order the weeks arrive in', () => {
    const funnel = weeklyFunnel(cycle({}, [{ week_start: '2026-11-16', type: 'plan_confirmed', households: 1 }, { week_start: '2026-11-09', type: 'plan_confirmed', households: 0 }]));
    expect(funnel).toMatchObject({ label: '16 Nov', composed: 1, households: 2 });
    expect(funnel?.steps).toEqual([
      { id: 'composed', label: 'Composed', count: 1 },
      { id: 'confirmed', label: 'Confirmed', count: 1 },
      { id: 'list', label: 'List built', count: 0 },
      { id: 'coles', label: 'Sent to Coles', count: 0 },
      { id: 'done', label: 'Done', count: 0 },
    ]);
  });

  it('is null when there are no weeks, and still has the week when nobody composed a plan', () => {
    expect(weeklyFunnel(cycle({ weeks: [] }))).toBeNull();
    expect(weeklyFunnel(cycle({ weeks: [{ week_start: '2026-11-16', composed: 0, recipes_ai: 0, recipes_imported: 0, recipes_user_added: 0 }] }))?.composed).toBe(0);
  });

  it('stops at composing when product events are unavailable, instead of a row of zeros', () => {
    const funnel = weeklyFunnel(cycle({ households_total: 1 }, [], false));
    expect(funnel?.steps).toEqual([{ id: 'composed', label: 'Composed', count: 1 }]);
  });
});

describe('weekSteps (#286)', () => {
  it('is every step of the given week, with zeros for the events when they are not available', () => {
    const funnel = [{ week_start: '2026-11-16', type: 'coles_list_sent', households: 1 }, { week_start: '2026-11-09', type: 'coles_list_sent', households: 5 }];
    expect(weekSteps(cycle({}, funnel), '2026-11-16', 4).map((step) => [step.id, step.count])).toEqual([['composed', 4], ['confirmed', 0], ['list', 0], ['coles', 1], ['done', 0]]);
    expect(weekSteps(cycle({}, [], false), '2026-11-16', 2).map((step) => step.count)).toEqual([2, 0, 0, 0, 0]);
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
