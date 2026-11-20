import { describe, it, expect } from 'vitest';
import type { HouseholdRow } from '../types';
import {
  ago,
  agoWithStamp,
  formatBytes,
  formatCount,
  formatDuration,
  formatMs,
  formatUsd,
  hasManyDeadTuples,
  sortHouseholds,
  utcShort,
  utcStamp,
  parseHouseholdParam,
  parseRange,
  projectMonthEnd,
  quotaLevel,
  rangeStart,
  resolveHousehold,
  shareLabel,
  shortId,
  successPct,
  toHouseholdRow,
  weekLabel,
} from '../format';
import { adminLinks, supabaseProjectRef } from '../links';

describe('range and household parameters', () => {
  it('parses ?range= to 24h, 7d or 30d, defaulting to 7d', () => {
    expect(parseRange('24h')).toBe('24h');
    expect(parseRange('30d')).toBe('30d');
    expect(parseRange(['24h', '30d'])).toBe('24h');
    for (const bad of [undefined, '', '90d', '7D', 'drop table']) expect(parseRange(bad)).toBe('7d');
  });

  it('turns a range into a start time', () => {
    const now = new Date('2026-11-18T12:00:00Z');
    expect(rangeStart('24h', now).toISOString()).toBe('2026-11-17T12:00:00.000Z');
    expect(rangeStart('7d', now).toISOString()).toBe('2026-11-11T12:00:00.000Z');
    expect(rangeStart('30d', now).toISOString()).toBe('2026-10-19T12:00:00.000Z');
  });

  it('accepts only an 8-character short id for ?household=', () => {
    expect(parseHouseholdParam('abcdef12')).toBe('abcdef12');
    for (const bad of [undefined, '', 'ABCDEF12', 'abcdef1', 'abcdef123', 'abcdefgh', 'a@b.co']) expect(parseHouseholdParam(bad)).toBeNull();
  });

  it('resolves a short id to the full id on the server, and strips the full id from what is rendered', () => {
    const raw = { id: 'abcdef12-3456-7890-abcd-ef1234567890', members: 2 } as Parameters<typeof toHouseholdRow>[0];
    expect(shortId(raw.id)).toBe('abcdef12');
    expect(resolveHousehold('abcdef12', [raw])).toBe(raw.id);
    expect(resolveHousehold('00000000', [raw])).toBeNull();
    expect(resolveHousehold(null, [raw])).toBeNull();
    const view = toHouseholdRow(raw);
    expect(view.shortId).toBe('abcdef12');
    expect(view).not.toHaveProperty('id');
    expect(JSON.stringify(view)).not.toContain('3456-7890');
  });
});

describe('number formatting', () => {
  it('shows counts, not percentages, under 10', () => {
    expect(shareLabel(2, 3)).toBe('2 of 3');
    expect(shareLabel(0, 9)).toBe('0 of 9');
    expect(shareLabel(5, 10)).toBe('50%');
    expect(shareLabel(0, 0)).toBe('–');
  });

  it('computes success rates, bytes and dollars', () => {
    expect(successPct(9, 10)).toBe(90);
    expect(successPct(1, 3)).toBe(33.3);
    expect(successPct(0, 0)).toBeNull();
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(120 * 1024 * 1024)).toBe('120 MB');
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatUsd(0.0123)).toBe('$0.012');
    expect(formatUsd(12.5)).toBe('$12.50');
  });

  it('projects the month end from the spend so far, a day counting as a fraction', () => {
    // Half way through 10 Nov (9.5 days elapsed) with $9.50 spent: $1 a day, 30 days in November.
    const p = projectMonthEnd(9.5, new Date('2026-11-10T12:00:00Z'));
    expect(p.daysElapsed).toBeCloseTo(9.5);
    expect(p.daysInMonth).toBe(30);
    expect(p.projectedUsd).toBeCloseTo(30);
    // At the very start of the month there is nothing to scale: the spend so far.
    expect(projectMonthEnd(0, new Date('2026-12-01T00:00:00Z')).projectedUsd).toBe(0);
    expect(projectMonthEnd(0.4, new Date('2026-12-01T00:00:00Z')).projectedUsd).toBe(0.4);
    expect(projectMonthEnd(1, new Date('2028-02-15T00:00:00Z')).daysInMonth).toBe(29);
  });

  it('labels weeks and ages', () => {
    expect(weekLabel('2026-11-16')).toBe('16 Nov');
    const now = new Date('2026-11-18T12:00:00Z');
    expect(ago(null, now)).toBe('never');
    expect(ago('2026-11-18T11:59:50Z', now)).toBe('just now');
    expect(ago('2026-11-18T11:30:00Z', now)).toBe('30 min ago');
    expect(ago('2026-11-18T06:00:00Z', now)).toBe('6 h ago');
    expect(ago('2026-11-10T12:00:00Z', now)).toBe('8 d ago');
  });
});

describe('admin links', () => {
  it('derives the Supabase project from the public URL, and gives no links for anything else', () => {
    expect(supabaseProjectRef('https://abcd1234.supabase.co')).toBe('abcd1234');
    expect(supabaseProjectRef('http://127.0.0.1:54321')).toBeNull();
    expect(supabaseProjectRef(undefined)).toBeNull();
    expect(supabaseProjectRef('not a url')).toBeNull();
    expect(adminLinks({ NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321' }).supabase).toEqual([]);
  });

  it('links to query performance and the advisors, the Vercel project, and the debug pages', () => {
    const links = adminLinks({ NEXT_PUBLIC_SUPABASE_URL: 'https://abcd1234.supabase.co', ADMIN_VERCEL_PROJECT_URL: 'https://vercel.com/team/app/' });
    expect(links.supabase.map((l) => l.href)).toEqual(
      expect.arrayContaining([
        'https://supabase.com/dashboard/project/abcd1234/observability/query-performance',
        'https://supabase.com/dashboard/project/abcd1234/advisors/performance',
        'https://supabase.com/dashboard/project/abcd1234/advisors/security',
      ])
    );
    expect(links.vercel[0].href).toBe('https://vercel.com/team/app/');
    expect(links.vercel[1].href).toBe('https://vercel.com/team/app/logs');
    expect(links.debug.map((l) => l.href)).toContain('/admin/debug');
    expect(links.debug.map((l) => l.href)).toContain('/debug/api-usage');
  });
});

describe('readability helpers (#270)', () => {
  const row = (shortId: string, last_active: string | null): HouseholdRow => ({ shortId, isYou: false, members: 1, pending_invites: 0, last_active, has_plan_this_week: false, settings_complete: false, ai_calls: 0, ai_cost_usd: 0, errors: 0, last3_generation_failed: false });

  it('sorts households by most recent activity, never-active last, without changing the input', () => {
    const input = [row('c', null), row('a', '2026-11-01T00:00:00Z'), row('b', '2026-11-10T00:00:00Z')];
    expect(sortHouseholds(input).map((h) => h.shortId)).toEqual(['b', 'a', 'c']);
    expect(input.map((h) => h.shortId)).toEqual(['c', 'a', 'b']);
    expect(sortHouseholds([row('x', null), row('y', null)]).map((h) => h.shortId)).toEqual(['x', 'y']);
  });

  it('marks a household as the viewer\'s when they belong to it, and strips the full ID', () => {
    const raw = { id: 'abcdef12-0000', members: 1, pending_invites: 0, last_active: null, has_plan_this_week: false, settings_complete: false, ai_calls: 0, ai_cost_usd: 0, errors: 0, last3_generation_failed: false };
    expect(toHouseholdRow(raw, new Set(['abcdef12-0000']))).toMatchObject({ shortId: 'abcdef12', isYou: true });
    expect(toHouseholdRow(raw, new Set(['other', 'abcdef12-0000']))).toMatchObject({ isYou: true });
    expect(toHouseholdRow(raw, new Set(['other']))).toMatchObject({ isYou: false });
    expect(toHouseholdRow(raw)).toMatchObject({ isYou: false });
    expect(JSON.stringify(toHouseholdRow(raw, new Set(['abcdef12-0000'])))).not.toContain('abcdef12-0000');
  });

  it('only flags dead tuples on tables with at least 1,000 estimated rows and over 20% dead', () => {
    expect(hasManyDeadTuples({ rows: 2, dead_ratio: 0.33 })).toBe(false);
    expect(hasManyDeadTuples({ rows: 999, dead_ratio: 0.9 })).toBe(false);
    expect(hasManyDeadTuples({ rows: 1000, dead_ratio: 0.2 })).toBe(false);
    expect(hasManyDeadTuples({ rows: 1000, dead_ratio: 0.21 })).toBe(true);
  });

  it('formats durations and UTC timestamps', () => {
    expect(formatDuration(45 * 60_000)).toBe('45 min');
    expect(formatDuration(3 * 3_600_000)).toBe('3 h');
    expect(formatDuration(130 * 60_000)).toBe('2 h 10 min');
    expect(formatDuration(-5)).toBe('0 min');
    expect(utcStamp('2026-11-19T09:16:30Z')).toBe('2026-11-19 09:16 UTC');
  });

  it('formats latencies: milliseconds under a second, else seconds to one decimal', () => {
    expect(formatMs(850)).toBe('850 ms');
    expect(formatMs(999.4)).toBe('999 ms');
    expect(formatMs(999.6)).toBe('1.0 s');
    expect(formatMs(99_960)).toBe('100 s');
    expect(formatMs(1000)).toBe('1.0 s');
    expect(formatMs(7528)).toBe('7.5 s');
    expect(formatMs(120_000)).toBe('120 s');
    expect(formatMs(null)).toBe('–');
    expect(formatMs(undefined)).toBe('–');
  });

  it('formats counts with thousands separators, and a dash for none', () => {
    expect(formatCount(1234567)).toBe('1,234,567');
    expect(formatCount(0)).toBe('0');
    expect(formatCount(null)).toBe('–');
  });

  it('grades usage against a limit: ok, warning from the threshold, error at the limit', () => {
    expect(quotaLevel(1, 5, 0.8)).toBe('ok');
    expect(quotaLevel(4, 5, 0.8)).toBe('warning');
    expect(quotaLevel(5, 5, 0.8)).toBe('error');
    expect(quotaLevel(7, 5, 0.8)).toBe('error');
    expect(quotaLevel(0, 0, 0.8)).toBe('unknown');
  });

  it('shows relative time first with the exact UTC time beside it', () => {
    const now = new Date('2026-11-19T12:00:00Z');
    expect(agoWithStamp('2026-11-19T09:16:30Z', now)).toBe('3 h ago (2026-11-19 09:16 UTC)');
    expect(agoWithStamp('2026-11-19T11:59:50Z', now)).toBe('just now (2026-11-19 11:59 UTC)');
    expect(agoWithStamp(null, now)).toBe('never');
    expect(agoWithStamp(undefined, now)).toBe('never');
  });

  it('shortens a UTC time for a narrow column, in UTC whatever the viewer\'s time zone', () => {
    expect(utcShort('2026-11-19T09:16:30Z')).toBe('19 Nov 09:16');
    expect(utcShort('2026-12-31T23:59:00Z')).toBe('31 Dec 23:59');
  });
});
