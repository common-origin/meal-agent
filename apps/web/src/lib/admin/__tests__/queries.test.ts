// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const FULL_ID = 'abcdef12-3456-7890-abcd-ef1234567890';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  healthRows: [] as { created_at: string; ok: boolean; release?: string; checks?: unknown; total_latency_ms?: number }[],
  rangeCalls: [] as [number, number][],
  readColesQuota: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    rpc: (name: string, args?: Record<string, unknown>) => mocks.rpc(name, args),
    from: (table: string) => {
      if (table !== 'health_checks') throw new Error(`unexpected table ${table}`);
      const q = {
        select: () => q,
        gte: () => q,
        order: () => q,
        limit: () => q,
        range: (from: number, to: number) => {
          mocks.rangeCalls.push([from, to]);
          return Promise.resolve({ data: mocks.healthRows.slice(from, to + 1), error: null });
        },
        maybeSingle: () => Promise.resolve({ data: mocks.healthRows[mocks.healthRows.length - 1] ?? null, error: null }),
      };
      return q;
    },
  }),
}));
vi.mock('@/lib/coles/quota', () => ({ readColesQuota: mocks.readColesQuota }));

import { loadDashboard } from '../queries';

const now = new Date('2026-11-18T12:07:00Z');
const SLOT = 15 * 60_000;

const results: Record<string, unknown> = {};
function setRpc(overrides: Record<string, unknown | Error> = {}) {
  const defaults: Record<string, unknown> = {
    admin_household_summary: [
      { id: FULL_ID, members: 2, pending_invites: 1, last_active: '2026-11-18T11:00:00Z', has_plan_this_week: true, settings_complete: true, ai_calls: 3, ai_cost_usd: 0.03, errors: 0, last3_generation_failed: false },
    ],
    admin_error_groups: [],
    admin_ai_summary: { by_task: [], daily: [], failures: [], billing_errors: 0 },
    admin_weekly_cycle: { first_week: '2026-09-28', last_week: '2026-11-16', households_total: 1, weeks: [], cuisines: { households: 0, avg: null, max: null }, events: { available: true, funnel: [], swaps: {}, edits: {}, ratings: { count: 0, avg: null, by_star: {} }, counts: {} } },
    admin_db_stats: [],
    admin_schema_check: [{ migration: '019', name: 'app_errors', applied: true }],
    ai_spend_since: 1.25,
  };
  Object.assign(results, defaults, overrides);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rangeCalls = [];
  mocks.healthRows = [];
  for (const key of Object.keys(results)) delete results[key];
  setRpc();
  mocks.rpc.mockImplementation(async (name: string) => {
    const value = results[name];
    if (value instanceof Error) return { data: null, error: { message: value.message } };
    return { data: value, error: null };
  });
  mocks.readColesQuota.mockResolvedValue({ used: 100, limit: 1000, remaining: 900, month: '2026-11' });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

const callsTo = (name: string) => mocks.rpc.mock.calls.filter((c) => c[0] === name);

describe('loadDashboard (#249)', () => {
  it('loads every section, and the household list carries the short ID only', async () => {
    const data = await loadDashboard({ range: '7d', household: null }, now);
    for (const section of ['status', 'errors', 'ai', 'cost', 'households', 'cycle', 'database', 'attention'] as const) {
      expect(data[section].ok, section).toBe(true);
    }
    if (!data.households.ok) throw new Error('households failed');
    expect(data.households.data[0]).toMatchObject({ shortId: 'abcdef12', members: 2 });
    expect(JSON.stringify(data)).not.toContain(FULL_ID);
    expect(JSON.stringify(data)).not.toContain('3456-7890');
  });

  it('resolves ?household= from the short ID to the full ID for the filtered sections only', async () => {
    const data = await loadDashboard({ range: '7d', household: 'abcdef12' }, now);
    expect(data.household).toBe('abcdef12');
    expect(callsTo('admin_error_groups')[0][1]).toMatchObject({ p_household: FULL_ID });
    expect(callsTo('admin_ai_summary').some((c) => (c[1] as { p_household: string | null }).p_household === FULL_ID)).toBe(true);
    expect(callsTo('admin_weekly_cycle')[0][1]).toMatchObject({ p_household: FULL_ID, p_weeks: 8 });
    // The attention rules look across every household, whatever the page is filtered to.
    expect(callsTo('admin_ai_summary').some((c) => (c[1] as { p_household: string | null }).p_household === null)).toBe(true);
    expect(JSON.stringify(data)).not.toContain(FULL_ID);
  });

  it('shares the schema check, spend and Coles reads between the sections and the attention rules', async () => {
    await loadDashboard({ range: '7d', household: null }, now);
    expect(callsTo('admin_schema_check')).toHaveLength(1);
    expect(callsTo('admin_db_stats')).toHaveLength(1);
    expect(callsTo('admin_household_summary')).toHaveLength(1);
    expect(callsTo('ai_spend_since')).toHaveLength(2); // today and month to date, once each
    expect(mocks.readColesQuota).toHaveBeenCalledTimes(1);
  });

  it('ignores a short ID that matches no household', async () => {
    const data = await loadDashboard({ range: '7d', household: '00000000' }, now);
    expect(data.household).toBeNull();
    expect(callsTo('admin_error_groups')[0][1]).toMatchObject({ p_household: null });
  });

  it('a section that fails shows "couldn\'t load" with its migration hint, and the others still load', async () => {
    setRpc({ admin_error_groups: new Error('relation "public.app_errors" does not exist'), admin_weekly_cycle: new Error('function does not exist') });
    const data = await loadDashboard({ range: '7d', household: null }, now);
    expect(data.errors).toEqual({ ok: false, hint: expect.stringContaining('019') });
    expect(data.cycle).toEqual({ ok: false, hint: expect.stringContaining('022') });
    expect(data.ai.ok).toBe(true);
    expect(data.households.ok).toBe(true);
    expect(data.database.ok).toBe(true);
    // The hint never carries the raw database message.
    expect(JSON.stringify(data)).not.toContain('does not exist');
  });

  it('a failing household list degrades its own section and nothing else', async () => {
    setRpc({ admin_household_summary: new Error('function does not exist') });
    const data = await loadDashboard({ range: '7d', household: 'abcdef12' }, now);
    expect(data.households.ok).toBe(false);
    expect(data.household).toBeNull();
    expect(data.errors.ok).toBe(true);
  });

  it('with no health table or rows, the status section still loads and says there is no check', async () => {
    const data = await loadDashboard({ range: '24h', household: null }, now);
    if (!data.status.ok) throw new Error('status failed');
    expect(data.status.data.latest).toBeNull();
    expect(data.status.data.heartbeatStale).toBe(true);
    expect(data.status.data.uptime.uptimePct).toBeNull();
  });

  it('reads every health row past the 1,000-row request limit when building uptime', async () => {
    // 30 days of 15-minute rows is 2,880: all of them must count.
    const end = Math.floor(now.getTime() / SLOT) * SLOT;
    const start = end - 30 * 86_400_000;
    mocks.healthRows = Array.from({ length: 2880 }, (_, i) => ({ created_at: new Date(start + i * SLOT + 60_000).toISOString(), ok: i % 10 !== 0, release: 'abc1234', checks: {}, total_latency_ms: 5 }));
    const data = await loadDashboard({ range: '30d', household: null }, now);
    if (!data.status.ok) throw new Error('status failed');
    // (The fake ignores the time filter, so the attention rules' 6-hour read pages through the same rows too.)
    expect(mocks.rangeCalls).toEqual(expect.arrayContaining([[0, 999], [1000, 1999], [2000, 2999]]));
    const { uptime } = data.status.data;
    expect(uptime.okSlots + uptime.failingSlots).toBeGreaterThan(2800);
    // One row in ten fails (288 of 2,880); the edges of the window can trim a slot or two.
    expect(uptime.failingSlots).toBeGreaterThanOrEqual(286);
    expect(uptime.failingSlots).toBeLessThanOrEqual(288);
    expect(uptime.uptimePct).toBeCloseTo(90, 0);
  });

  it('the cost section projects the month and reports the Coles quota', async () => {
    const data = await loadDashboard({ range: '7d', household: null }, now);
    if (!data.cost.ok) throw new Error('cost failed');
    expect(data.cost.data).toMatchObject({ spendTodayUsd: 1.25, monthToDateUsd: 1.25, coles: { used: 100, limit: 1000 } });
    expect(data.cost.data.capUsd).toBeGreaterThan(0);
    expect(data.cost.data.projectedMonthUsd).toBeGreaterThan(data.cost.data.monthToDateUsd);
  });

  it('attention says which checks could not run when their inputs fail', async () => {
    setRpc({ admin_error_groups: new Error('x'), admin_schema_check: new Error('x') });
    const data = await loadDashboard({ range: '7d', household: null }, now);
    if (!data.attention.ok) throw new Error('attention failed');
    const unavailable = data.attention.data.find((item) => item.id === 'checks-unavailable');
    expect(unavailable?.message).toMatch(/errors/);
    expect(unavailable?.message).toMatch(/migrations/);
  });
});
