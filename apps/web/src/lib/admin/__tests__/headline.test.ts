import { describe, it, expect } from 'vitest';
import { computeHeadline } from '../headline';
import { ERROR_GROUP_LIMIT } from '../format';
import type { DashboardData } from '../queries';
import type { CostData, ErrorGroup, HouseholdRow, StatusData } from '../types';

const now = new Date('2026-11-19T09:20:00Z');
const failed = { ok: false as const, hint: 'is migration 022 applied?' };

const status = (over: Partial<StatusData> = {}): StatusData => ({
  latest: { created_at: '2026-11-19T09:16:00Z', ok: true, release: 'abc1234', total_latency_ms: 100, checks: { database: { ok: true }, gemini: { ok: true } } },
  heartbeatStale: false,
  deployedRelease: 'abc1234',
  uptime: { from: 0, to: 0, slots: [], uptimePct: null, noDataShare: 0, okSlots: 0, failingSlots: 0, noDataSlots: 0, possibleOutages: [], outageNow: false, lastIncident: null, monitoringSince: null },
  ...over,
});
const cost = (spend: number): CostData => ({ spendTodayUsd: spend, capUsd: 5, monthToDateUsd: 1, projectedMonthUsd: 2, daysElapsed: 18, daysInMonth: 30, coles: null });
const group = (count: number): ErrorGroup => ({ fingerprint: `f${count}`, label: null, kind: 'Error', message: 'x', route: null, source: 'server', count, count_24h: count, count_7d: count, first_seen: '2026-11-19T00:00:00Z', last_seen: '2026-11-19T00:00:00Z', releases: [], households: 0, latest: [] });
const household = (last_active: string | null): HouseholdRow => ({ shortId: 'abcdef12', isYou: false, members: 1, pending_invites: 0, last_active, has_plan_this_week: false, settings_complete: true, ai_calls: 0, ai_cost_usd: 0, errors: 0, last3_generation_failed: false });

const data = (over: Partial<DashboardData> = {}): DashboardData => ({
  range: '7d',
  household: null,
  generatedAt: now.toISOString(),
  attention: { ok: true, data: [] },
  status: { ok: true, data: status() },
  errors: { ok: true, data: [] },
  ai: failed,
  cost: { ok: true, data: cost(0.5) },
  households: { ok: true, data: [household('2026-11-18T00:00:00Z'), household('2026-09-01T00:00:00Z'), household(null)] },
  cycle: failed,
  database: failed,
  ...over,
});

const tile = (headline: ReturnType<typeof computeHeadline>, id: string) => headline.tiles.find((t) => t.id === id)!;

describe('computeHeadline (#270)', () => {
  it('says "All systems OK" with nothing to attend to', () => {
    expect(computeHeadline(data(), now)).toMatchObject({ title: 'All systems OK' });
  });

  it('counts the things that need attention, and calls it an error if any is', () => {
    const warning = { id: 'a', severity: 'warning' as const, section: 'errors' as const, message: 'x' };
    const error = { id: 'b', severity: 'error' as const, section: 'status' as const, message: 'y' };
    expect(computeHeadline(data({ attention: { ok: true, data: [warning] } }), now)).toMatchObject({ title: '1 thing needs attention' });
    expect(computeHeadline(data({ attention: { ok: true, data: [warning, error] } }), now)).toMatchObject({ title: '2 things need attention' });
  });

  it('says so when the rules could not run, rather than claiming all is well', () => {
    expect(computeHeadline(data({ attention: failed }), now)).toMatchObject({ title: "Couldn't work out what needs attention" });
  });

  it('status tile: healthy, failing (naming the check), stale, none yet, and unavailable', () => {
    expect(tile(computeHeadline(data(), now), 'status')).toMatchObject({ value: 'Healthy', tone: 'ok', note: 'Checked 4 min ago' });

    const failing = status({ latest: { created_at: '2026-11-19T09:16:00Z', ok: false, release: 'a', total_latency_ms: 1, checks: { database: { ok: true }, gemini: { ok: false } } } });
    expect(tile(computeHeadline(data({ status: { ok: true, data: failing } }), now), 'status')).toMatchObject({ value: 'Failing', note: 'gemini failing', tone: 'bad' });

    expect(tile(computeHeadline(data({ status: { ok: true, data: status({ heartbeatStale: true }) } }), now), 'status')).toMatchObject({ value: 'No recent check', tone: 'bad', note: 'Last check 4 min ago (it passed)' });
    expect(tile(computeHeadline(data({ status: { ok: true, data: status({ latest: null }) } }), now), 'status')).toMatchObject({ value: 'No checks yet', tone: 'neutral' });
    expect(tile(computeHeadline(data({ status: failed }), now), 'status')).toMatchObject({ value: 'Unavailable', tone: 'neutral' });
  });

  it('status tile: a stale heartbeat outranks an old failure, which is named as past', () => {
    const staleFailing = status({
      heartbeatStale: true,
      latest: { created_at: '2026-11-19T03:16:00Z', ok: false, release: 'a', total_latency_ms: 1, checks: { database: { ok: true }, gemini: { ok: false } } },
    });
    expect(tile(computeHeadline(data({ status: { ok: true, data: staleFailing } }), now), 'status')).toMatchObject({ value: 'No recent check', note: 'Last check 6 h ago (gemini failing then)', tone: 'bad' });
  });

  it('errors tile says "at least" when the error groups hit the query cap', () => {
    const groups = Array.from({ length: ERROR_GROUP_LIMIT }, () => group(2));
    expect(tile(computeHeadline(data({ errors: { ok: true, data: groups } }), now), 'errors')).toMatchObject({
      value: `${2 * ERROR_GROUP_LIMIT}+`,
      note: `${ERROR_GROUP_LIMIT}+ kinds of error (only the latest ${ERROR_GROUP_LIMIT} are counted)`,
    });
    expect(tile(computeHeadline(data({ errors: { ok: true, data: groups.slice(1) } }), now), 'errors').value).toBe(String(2 * (ERROR_GROUP_LIMIT - 1)));
  });

  it('errors tile: total occurrences and how many kinds, labelled with the range', () => {
    expect(tile(computeHeadline(data(), now), 'errors')).toMatchObject({ label: 'Errors, last 7 days', value: '0', tone: 'ok' });
    expect(tile(computeHeadline(data({ range: '24h', errors: { ok: true, data: [group(3), group(2)] } }), now), 'errors')).toMatchObject({ label: 'Errors, last 24 hours', value: '5', note: '2 kinds of error', tone: 'warning' });
    expect(tile(computeHeadline(data({ errors: { ok: true, data: [group(1)] } }), now), 'errors').note).toBe('1 kind of error');
  });

  it('errors tile says when the page is filtered to one household', () => {
    expect(tile(computeHeadline(data({ household: 'abcdef12' }), now), 'errors').label).toBe('Errors, last 7 days, household abcdef12');
  });

  it('AI spend tile warns from 80% of the daily cap and fails at 100%', () => {
    expect(tile(computeHeadline(data({ cost: { ok: true, data: cost(3.9) } }), now), 'ai')).toMatchObject({ tone: 'ok', note: 'of $5.00 daily cap' });
    expect(tile(computeHeadline(data({ cost: { ok: true, data: cost(4) } }), now), 'ai').tone).toBe('warning');
    expect(tile(computeHeadline(data({ cost: { ok: true, data: cost(5) } }), now), 'ai').tone).toBe('bad');
  });

  it('households tile counts those active within the range', () => {
    expect(tile(computeHeadline(data(), now), 'households')).toMatchObject({ value: '1 of 3', note: 'used the app in the last 7 days' });
    expect(tile(computeHeadline(data({ range: '30d' }), now), 'households').value).toBe('1 of 3');
    expect(tile(computeHeadline(data({ range: '24h' }), now), 'households').value).toBe('0 of 3');
  });

  it('every tile links to a section on the page', () => {
    expect(computeHeadline(data(), now).tiles.map((t) => t.href)).toEqual(['#status', '#errors', '#cost', '#households']);
  });
});
