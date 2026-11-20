import { describe, it, expect } from 'vitest';
import { attentionWhen, computeAttention, countBySection, failingSince } from '../attention';
import type { AiSummary, ErrorGroup, HealthCheckRow, HouseholdRowRaw, SchemaCheck } from '../types';

const now = new Date('2026-11-18T12:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

const okRow: HealthCheckRow = { created_at: hoursAgo(0.1), ok: true, release: 'abc1234', checks: { database: { ok: true } }, total_latency_ms: 10 };
const group = (over: Partial<ErrorGroup> = {}): ErrorGroup => ({
  fingerprint: 'f1',
  label: 'coles-search: lookup failed',
  kind: 'Error',
  message: 'boom',
  route: '/api/coles-search',
  source: 'route',
  count: 1,
  count_24h: 1,
  count_7d: 10,
  first_seen: hoursAgo(24 * 20),
  last_seen: hoursAgo(1),
  releases: ['abc1234'],
  households: 1,
  latest: [],
  ...over,
});
const ai = (rows: { task: string; calls: number; ok_calls: number }[], billing = 0): AiSummary => ({
  by_task: rows.map((r) => ({ ...r, model: 'm', p50_ms: 1, p95_ms: 1, avg_input_tokens: 1, avg_output_tokens: 1, cost_usd: 0, statuses: {}, top_errors: [] })),
  daily: [],
  failures: [],
  billing_errors: billing,
});
const household = (over: Partial<HouseholdRowRaw> = {}): HouseholdRowRaw => ({
  id: 'abcdef12-0000-0000-0000-000000000000',
  members: 1,
  pending_invites: 0,
  last_active: null,
  has_plan_this_week: true,
  settings_complete: true,
  ai_calls: 0,
  ai_cost_usd: 0,
  errors: 0,
  last3_generation_failed: false,
  ...over,
});
const ids = (input: Parameters<typeof computeAttention>[0]) => computeAttention(input).map((i) => i.id);

describe('computeAttention (#249)', () => {
  it('has nothing to say when everything is healthy', () => {
    expect(
      computeAttention({
        now,
        health: { latest: okRow, heartbeatStale: false, outageNow: false },
        errors7d: [group()],
        ai24h: ai([{ task: 'generation', calls: 50, ok_calls: 50 }]),
        spend: { todayUsd: 1, capUsd: 5 },
        coles: { used: 100, limit: 1000 },
        schema: [{ migration: '019', name: 'app_errors', applied: true }],
        households: [household()],
      })
    ).toEqual([]);
  });

  it('flags no health check in 30 minutes, with no row at all or an old one', () => {
    const stale = computeAttention({ now, health: { latest: { ...okRow, created_at: hoursAgo(1) }, heartbeatStale: true, outageNow: false } });
    expect(stale[0]).toMatchObject({ id: 'heartbeat-stale', severity: 'error', section: 'status' });
    expect(stale[0].message).toMatch(/30 minutes/);
    const none = computeAttention({ now, health: { latest: null, heartbeatStale: true, outageNow: false } });
    expect(none[0].message).toMatch(/No health check has been recorded/);
  });

  it('flags a failing latest check, naming the failing dependencies', () => {
    const failing: HealthCheckRow = { ...okRow, ok: false, checks: { database: { ok: true }, gemini: { ok: false }, coles: { ok: false } } };
    const [item] = computeAttention({ now, health: { latest: failing, heartbeatStale: false, outageNow: false } });
    expect(item).toMatchObject({ id: 'health-failing', severity: 'error' });
    expect(item.message).toContain('gemini, coles');
    expect(item.message).not.toContain('database');
  });

  it('flags two or more consecutive empty heartbeat slots', () => {
    expect(ids({ now, health: { latest: okRow, heartbeatStale: false, outageNow: true } })).toEqual(['outage-now']);
  });

  it('flags a new error fingerprint in the last 24 hours, but not an old one that recurs', () => {
    expect(ids({ now, errors7d: [group({ first_seen: hoursAgo(3) })] })).toEqual(['new-errors']);
    expect(ids({ now, errors7d: [group({ first_seen: hoursAgo(30) })] })).toEqual([]);
    const many = computeAttention({ now, errors7d: [1, 2, 3, 4].map((n) => group({ fingerprint: `f${n}`, label: `label ${n}`, first_seen: hoursAgo(1) })) });
    expect(many[0].message).toMatch(/4 new errors/);
    expect(many[0].message).toContain('…');
  });

  it('flags an error spike: 24h count of 5+ and over 3x the 7-day daily average', () => {
    expect(ids({ now, errors7d: [group({ count_24h: 10, count_7d: 14 })] })).toEqual(['spike-f1']); // average 2 a day; 10 > 6
    expect(ids({ now, errors7d: [group({ count_24h: 4, count_7d: 4 })] })).toEqual([]); // under 5
    expect(ids({ now, errors7d: [group({ count_24h: 6, count_7d: 70 })] })).toEqual([]); // usual volume: average 10 a day
    expect(ids({ now, errors7d: [group({ count_24h: 6, count_7d: 14 })] })).toEqual([]); // 6 is not above 3 x 2
  });

  it('a new error that fires many times is one "new error" item, not also a spike (it has no usual rate yet)', () => {
    expect(ids({ now, errors7d: [group({ first_seen: hoursAgo(3), count_24h: 12, count_7d: 12 })] })).toEqual(['new-errors']);
  });

  it('flags an AI task under 90% success with at least 10 calls in 24h, summing its models', () => {
    expect(ids({ now, ai24h: ai([{ task: 'generation', calls: 10, ok_calls: 8 }]) })).toEqual(['ai-success-generation']);
    expect(ids({ now, ai24h: ai([{ task: 'generation', calls: 10, ok_calls: 9 }]) })).toEqual([]); // exactly 90%
    expect(ids({ now, ai24h: ai([{ task: 'generation', calls: 9, ok_calls: 0 }]) })).toEqual([]); // too few calls
    expect(ids({ now, ai24h: ai([{ task: 'generation', calls: 6, ok_calls: 4 }, { task: 'generation', calls: 6, ok_calls: 4 }]) })).toEqual(['ai-success-generation']);
  });

  it('flags any billing-type AI error in 24h', () => {
    const [item] = computeAttention({ now, ai24h: ai([], 2) });
    expect(item).toMatchObject({ id: 'ai-billing', severity: 'error', section: 'ai' });
    expect(ids({ now, ai24h: ai([], 0) })).toEqual([]);
  });

  it("flags today's AI spend at 80% of the cap, as an error at the cap", () => {
    expect(ids({ now, spend: { todayUsd: 3.9, capUsd: 5 } })).toEqual([]);
    expect(computeAttention({ now, spend: { todayUsd: 4, capUsd: 5 } })[0]).toMatchObject({ id: 'ai-spend', severity: 'warning' });
    expect(computeAttention({ now, spend: { todayUsd: 5.2, capUsd: 5 } })[0]).toMatchObject({ id: 'ai-spend', severity: 'error' });
  });

  it('flags Coles quota at 80%', () => {
    expect(ids({ now, coles: { used: 799, limit: 1000 } })).toEqual([]);
    expect(computeAttention({ now, coles: { used: 800, limit: 1000 } })[0]).toMatchObject({ id: 'coles-quota', severity: 'warning' });
    expect(computeAttention({ now, coles: { used: 1000, limit: 1000 } })[0]).toMatchObject({ severity: 'error' });
  });

  it('flags a migration that has not been run', () => {
    const schema: SchemaCheck[] = [
      { migration: '020', name: 'product_events', applied: false },
      { migration: '021', name: 'health_checks', applied: false },
      { migration: '019', name: 'app_errors', applied: true },
    ];
    const [item] = computeAttention({ now, schema });
    expect(item).toMatchObject({ id: 'migrations-missing', section: 'database' });
    expect(item.message).toContain('020, 021');
  });

  it('flags a household whose last 3 generation calls all failed, by short ID only', () => {
    const [item] = computeAttention({ now, households: [household({ last3_generation_failed: true }), household({ id: 'ffffffff-0000-0000-0000-000000000000' })] });
    expect(item).toMatchObject({ id: 'stuck-abcdef12', section: 'households' });
    expect(item.message).toContain('abcdef12');
    expect(item.message).not.toContain('abcdef12-0000');
  });

  it('says which checks could not run, rather than silently passing', () => {
    const [item] = computeAttention({ now, unavailable: ['errors', 'ai'] });
    expect(item.message).toContain('errors, ai');
  });

  it('skips a rule whose input is missing, and lists errors before warnings', () => {
    expect(computeAttention({ now })).toEqual([]);
    const items = computeAttention({ now, coles: { used: 900, limit: 1000 }, health: { latest: okRow, heartbeatStale: true, outageNow: false } });
    expect(items.map((i) => i.severity)).toEqual(['error', 'warning']);
  });
});

describe('attention items read like findings (#279)', () => {
  const failing: HealthCheckRow = { ...okRow, ok: false, checks: { database: { ok: true }, gemini: { ok: false, detail: 'billing_errors_last_hour' }, coles: { ok: false, detail: 'quota_used_up' } } };
  const everything = computeAttention({
    now,
    health: { latest: failing, heartbeatStale: true, outageNow: true, failingSince: hoursAgo(2) },
    errors7d: [group({ first_seen: hoursAgo(3) }), group({ fingerprint: 'f2', label: 'spiky', count_24h: 10, count_7d: 14 })],
    ai24h: ai([{ task: 'generation', calls: 10, ok_calls: 5 }], 2),
    spend: { todayUsd: 4.5, capUsd: 5 },
    coles: { used: 900, limit: 1000 },
    schema: [{ migration: '021', name: 'health_checks', applied: false }],
    households: [household({ last3_generation_failed: true })],
    unavailable: ['errors'],
  });

  it('every item has a title, a place, a period, fix steps and at least one action', () => {
    expect(everything.length).toBeGreaterThanOrEqual(11);
    for (const item of everything) {
      expect(item.title, item.id).not.toBe('');
      expect(item.where, item.id).toMatch(/ · /);
      expect(item.window, item.id).not.toBe('');
      expect(item.fix.length, item.id).toBeGreaterThan(0);
      expect(item.actions.length, item.id).toBeGreaterThan(0);
    }
  });

  it('every item has a unique id', () => {
    const idList = everything.map((item) => item.id);
    expect(new Set(idList).size).toBe(idList.length);
  });

  it('says where: the failing dependency, the route, the task, the migration, the household by short ID', () => {
    const where = Object.fromEntries(everything.map((item) => [item.id, item.where]));
    expect(where['health-failing']).toBe('Status · gemini, coles');
    expect(where['new-errors']).toBe('Errors · /api/coles-search');
    expect(where['spike-f2']).toBe('Errors · /api/coles-search');
    expect(where['ai-success-generation']).toBe('AI agent · generation');
    expect(where['migrations-missing']).toBe('Database · 021');
    expect(where['stuck-abcdef12']).toBe('Households · abcdef12');
    expect(JSON.stringify(everything)).not.toContain('abcdef12-0000');
  });

  it('says since when only where the data does: first seen, the last check, the start of the failing run', () => {
    const since = Object.fromEntries(everything.map((item) => [item.id, item.since]));
    expect(since['heartbeat-stale']).toBe(failing.created_at);
    expect(since['health-failing']).toBe(hoursAgo(2));
    expect(since['new-errors']).toBe(hoursAgo(3));
    expect(since['spike-f2']).toBeNull();
    expect(since['ai-spend']).toBeNull();
  });

  it('fix steps name what to do for each failing dependency', () => {
    const steps = everything.find((item) => item.id === 'health-failing')?.fix.join('\n') ?? '';
    expect(steps).toMatch(/gemini: .*Top up the prepaid credits/);
    expect(steps).toMatch(/coles: .*COLES_API_MONTHLY_LIMIT/);
    expect(steps).not.toMatch(/database:/); // it passed
  });

  it('a migration item names the file to run and links to the SQL editor', () => {
    const item = everything.find((entry) => entry.id === 'migrations-missing');
    expect(item?.fix[0]).toContain('021_health_checks.sql');
    expect(item?.actions.map((action) => action.target)).toContain('supabase-sql');
  });

  it('the Uptime workflow is offered for a stopped heartbeat', () => {
    expect(everything.find((item) => item.id === 'heartbeat-stale')?.actions.map((action) => action.target)).toContain('uptime-workflow');
  });

  it('uses "No health check recorded yet" for an empty table, and no since', () => {
    const [item] = computeAttention({ now, health: { latest: null, heartbeatStale: true, outageNow: false } });
    expect(item).toMatchObject({ title: 'No health check recorded yet', since: null });
  });
});

describe('failingSince', () => {
  const row = (h: number, ok: boolean) => ({ created_at: hoursAgo(h), ok });
  it('is the first failing check after the last passing one', () => {
    expect(failingSince([row(3, true), row(2, false), row(1, false), row(0, false)])).toBe(hoursAgo(2));
    expect(failingSince([row(0, false), row(3, true), row(1, false), row(2, false)])).toBe(hoursAgo(2)); // any order
  });
  it('is null when the newest check passes, or when no passing check bounds the run', () => {
    expect(failingSince([row(2, false), row(1, true)])).toBeNull();
    expect(failingSince([row(2, false), row(1, false)])).toBeNull();
    expect(failingSince([])).toBeNull();
  });
});

describe('countBySection', () => {
  it('counts the inbox items in each area, for the navigation badges', () => {
    const items = computeAttention({
      now,
      errors7d: [group({ first_seen: hoursAgo(3) }), group({ fingerprint: 'f2', label: 'spiky', count_24h: 10, count_7d: 14 })],
      spend: { todayUsd: 4.5, capUsd: 5 },
      schema: [{ migration: '021', name: 'health_checks', applied: false }],
    });
    expect(countBySection(items)).toEqual({ status: 0, errors: 2, ai: 0, cost: 1, households: 0, database: 1 });
  });
  it('is all zero for an empty inbox', () => {
    expect(countBySection([])).toEqual({ status: 0, errors: 0, ai: 0, cost: 0, households: 0, database: 0 });
  });
});

describe('attentionWhen', () => {
  it('reads "since …" when the rule knows, else the period it looked at', () => {
    expect(attentionWhen({ since: hoursAgo(3), window: 'last 24 hours' }, now)).toBe('since 3 h ago');
    expect(attentionWhen({ since: null, window: 'today (UTC)' }, now)).toBe('today (UTC)');
  });
});
