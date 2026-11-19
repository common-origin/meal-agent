// @vitest-environment node
/**
 * The reporting functions behind /admin (migration 022, #249), run against the
 * real migrations: each returns one jsonb value (so nothing is cut off at
 * Supabase's 1,000 rows), only the service role can run them, and they hold
 * no names or emails.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let t: TestDb;
let alice: string;
let bob: string;
let hhA: string;
let hhB: string;
let monday: string; // this week's Monday, Australia/Sydney
let lastMonday: string;

const call = async <T = unknown>(sql: string, params: unknown[] = []): Promise<T> =>
  (await t.as<{ r: T }>(null, `SELECT ${sql} AS r`, params, 'service_role'))[0].r;

beforeAll(async () => {
  t = await createTestDb();
  alice = await t.signUp('alice@example.com');
  bob = await t.signUp('bob@example.com');
  hhA = (await t.householdOf(alice))!.household_id;
  hhB = (await t.householdOf(bob))!.household_id;
  const { rows } = await t.db.query<{ m: string; l: string }>(
    `SELECT date_trunc('week', now() AT TIME ZONE 'Australia/Sydney')::date::text AS m,
            (date_trunc('week', now() AT TIME ZONE 'Australia/Sydney')::date - 7)::text AS l`,
  );
  monday = rows[0].m;
  lastMonday = rows[0].l;
  await t.db.query(`UPDATE public.family_settings SET full_settings = '{"location":{"timeZone":"Australia/Perth"}}' WHERE household_id = $1`, [hhA]);

  // AI calls: household A has 4 generation calls (one billing refusal), B one pantry scan.
  const ai = (user: string, hh: string, task: string, status: string, code: string | null, latency: number, cost: number, ago = '1 hour') =>
    t.db.query(
      `INSERT INTO public.ai_usage (user_id, household_id, task, model, latency_ms, status, error_code, input_tokens, output_tokens, cost_usd, created_at)
       VALUES ($1, $2, $3, 'gemini-x', $4, $5, $6, 1000, 500, $7, now() - $8::interval)`,
      [user, hh, task, latency, status, code, cost, ago],
    );
  await ai(alice, hhA, 'generation', 'ok', null, 100, 0.01);
  await ai(alice, hhA, 'generation', 'ok', null, 200, 0.01);
  await ai(alice, hhA, 'generation', 'ok', null, 300, 0.01);
  await ai(alice, hhA, 'generation', 'error', 'http_402', 50, 0);
  await ai(bob, hhB, 'pantryScan', 'ok', null, 80, 0.001);
  await ai(bob, hhB, 'generation', 'error', 'http_503', 60, 0, '10 days'); // outside a 7-day window
  // Household B's last three generation calls all failed.
  await ai(bob, hhB, 'generation', 'error', 'http_503', 60, 0, '3 hours');
  await ai(bob, hhB, 'generation', 'timeout', 'timeout', 60, 0, '2 hours');
  await ai(bob, hhB, 'generation', 'error', 'http_503', 60, 0, '30 minutes');

  const err = (release: string, hh: string | null, fp: string, ago: string, label: string | null = null) =>
    t.db.query(
      `INSERT INTO public.app_errors (release, source, route, label, kind, message, fingerprint, household_id, created_at)
       VALUES ($1, 'route', '/api/x', $2, 'Error', 'boom [n]', $3, $4, now() - $5::interval)`,
      [release, label, fp, hh, ago],
    );
  await err('aaa1111', hhA, 'old', '1 hour');
  await err('aaa1111', hhA, 'old', '2 hours');
  await err('bbb2222', hhB, 'old', '3 hours');
  await err('aaa1111', null, 'old', '20 days'); // first seen long ago
  await err('ccc3333', hhA, 'fresh', '30 minutes', 'x: failed');
});

describe('admin_ai_summary', () => {
  it('summarises per task and model: calls, success, percentiles, tokens, cost, statuses, top errors', async () => {
    const s = await call<{ by_task: Record<string, unknown>[]; daily: unknown[]; failures: Record<string, unknown>[]; billing_errors: number }>(
      `public.admin_ai_summary(now() - interval '7 days')`,
    );
    const gen = s.by_task.find((r) => r.task === 'generation')!;
    expect(gen).toMatchObject({ calls: 7, ok_calls: 3, p50_ms: 60, avg_input_tokens: 1000, avg_output_tokens: 500 });
    expect(gen.statuses).toEqual({ ok: 3, error: 3, timeout: 1 });
    expect(gen.top_errors).toEqual([
      { code: 'http_503', count: 2 },
      { code: 'http_402', count: 1 },
      { code: 'timeout', count: 1 },
    ]);
    expect(Number(gen.cost_usd)).toBeCloseTo(0.03);
    expect(s.by_task.find((r) => r.task === 'pantryScan')).toMatchObject({ calls: 1, ok_calls: 1 });
    expect(s.billing_errors).toBe(1);
    expect(s.failures).toHaveLength(4);
    expect(s.failures[0]).toMatchObject({ status: 'error', error_code: 'http_503' }); // newest first
    expect(Object.keys(s.failures[0]).sort()).toEqual(['created_at', 'error_code', 'latency_ms', 'model', 'status', 'task']);
    expect(s.daily.length).toBeGreaterThan(0);
  });

  it('honours the window, the household and the billing codes', async () => {
    const day = await call<{ by_task: { calls: number; task: string }[] }>(`public.admin_ai_summary(now() - interval '24 hours', $1)`, [hhA]);
    expect(day.by_task).toHaveLength(1);
    expect(day.by_task[0]).toMatchObject({ task: 'generation', calls: 4 });
    const none = await call<{ billing_errors: number }>(`public.admin_ai_summary(now() - interval '24 hours', NULL, ARRAY['http_999'])`);
    expect(none.billing_errors).toBe(0);
  });

  it('is empty, not an error, when there are no calls', async () => {
    const s = await call<{ by_task: unknown[]; daily: unknown[]; failures: unknown[] }>(`public.admin_ai_summary(now() + interval '1 day')`);
    expect(s).toMatchObject({ by_task: [], daily: [], failures: [], billing_errors: 0 });
  });
});

describe('admin_error_groups', () => {
  it('groups by fingerprint with counts, releases, households, first and last seen, and the latest occurrences', async () => {
    const groups = await call<Record<string, unknown>[]>(`public.admin_error_groups(now() - interval '7 days')`);
    expect(groups.map((g) => g.fingerprint)).toEqual(['fresh', 'old']); // newest last_seen first
    const old = groups.find((g) => g.fingerprint === 'old')!;
    expect(old).toMatchObject({ count: 3, count_24h: 3, count_7d: 3, households: 2, label: null, kind: 'Error', route: '/api/x', source: 'route' });
    expect(old.releases).toEqual(['aaa1111', 'bbb2222']);
    expect((old.latest as unknown[]).length).toBe(3);
    // first_seen is the first ever, including the error from 20 days ago that is outside the window.
    expect(Date.now() - new Date(old.first_seen as string).getTime()).toBeGreaterThan(19 * 86_400_000);
    const fresh = groups.find((g) => g.fingerprint === 'fresh')!;
    expect(fresh).toMatchObject({ label: 'x: failed', count: 1 });
    expect(Date.now() - new Date(fresh.first_seen as string).getTime()).toBeLessThan(2 * 3_600_000);
  });

  it('filters by household and caps the latest occurrences at 10', async () => {
    const onlyB = await call<{ fingerprint: string }[]>(`public.admin_error_groups(now() - interval '7 days', $1)`, [hhB]);
    expect(onlyB.map((g) => g.fingerprint)).toEqual(['old']);
    for (let i = 0; i < 15; i++) {
      await t.db.query(`INSERT INTO public.app_errors (release, source, kind, fingerprint) VALUES ('r', 'client', 'Error', 'many')`);
    }
    const many = (await call<{ fingerprint: string; count: number; latest: unknown[] }[]>(`public.admin_error_groups(now() - interval '1 hour')`)).find(
      (g) => g.fingerprint === 'many',
    )!;
    expect(many.count).toBe(15);
    expect(many.latest).toHaveLength(10);
  });

  it('counts past the 1,000-row request limit', async () => {
    await t.db.query(
      `INSERT INTO public.app_errors (release, source, kind, fingerprint) SELECT 'r', 'server', 'Error', 'thousands' FROM generate_series(1, 1500)`,
    );
    const g = (await call<{ fingerprint: string; count: number }[]>(`public.admin_error_groups(now() - interval '1 hour')`)).find((x) => x.fingerprint === 'thousands')!;
    expect(g.count).toBe(1500);
  });
});

describe('admin_weekly_cycle', () => {
  beforeAll(async () => {
    // A plans this week and last; B plans only last week.
    for (const [hh, week] of [[hhA, monday], [hhA, lastMonday], [hhB, lastMonday]] as const) {
      await t.db.query(`INSERT INTO public.meal_plans (household_id, week_start, meals) VALUES ($1, $2, '{}')`, [hh, week]);
    }
    const ev = (hh: string, type: string, props: object, ago = '1 hour') =>
      t.db.query(`INSERT INTO public.product_events (household_id, type, props, release, created_at) VALUES ($1, $2, $3, 'dev', now() - $4::interval)`, [hh, type, JSON.stringify(props), ago]);
    await ev(hhA, 'plan_confirmed', { weekStart: monday });
    await ev(hhA, 'plan_confirmed', { weekStart: lastMonday });
    await ev(hhB, 'plan_confirmed', { weekStart: lastMonday });
    await ev(hhA, 'shopping_list_built', { weekStart: lastMonday, itemCount: 30 });
    await ev(hhA, 'coles_list_sent', { weekStart: lastMonday, itemCount: 30 });
    await ev(hhA, 'shopping_completed', { weekStart: lastMonday });
    await ev(hhA, 'swap', { kind: 'swap' });
    await ev(hhA, 'swap', { kind: 'delete' });
    await ev(hhA, 'swap', { kind: 'add' }); // adding isn't counted as manual effort
    await ev(hhA, 'plan_edit_accepted', { nights: 2 });
    await ev(hhA, 'recipe_rated', { stars: 4 });
    await ev(hhB, 'recipe_rated', { stars: 5 });
    // Recipes by source, and cooked cuisines.
    const recipe = (id: string, hh: string, source: string | null, cuisine: string | null) =>
      t.db.query(`INSERT INTO public.recipes (id, household_id, title, time_mins, serves, ingredients, source_domain, cuisine) VALUES ($1, $2, 'T', 30, 4, '[]', $3, $4)`, [id, hh, source, cuisine]);
    await recipe('r1', hhA, 'ai-generated', 'italian');
    await recipe('r2', hhA, 'ai-generated', 'thai');
    await recipe('r3', hhA, 'www.example-food.com', null);
    await recipe('r4', hhA, 'user-added', null);
    await recipe('r5', hhB, 'ai-generated', 'italian');
    for (const [hh, id] of [[hhA, 'r1'], [hhA, 'r2'], [hhB, 'r5']] as const) {
      await t.db.query(`INSERT INTO public.recipe_history (household_id, recipe_id, week_start) VALUES ($1, $2, $3)`, [hh, id, lastMonday]);
    }
  });

  it('returns eight ISO weeks ending this week, newest first, with plans per planned week', async () => {
    const c = await call<{ weeks: Record<string, unknown>[]; households_total: number; last_week: string }>(`public.admin_weekly_cycle(8)`);
    expect(c.weeks).toHaveLength(8);
    expect(c.weeks[0].week_start).toBe(monday);
    expect(c.weeks[1].week_start).toBe(lastMonday);
    expect(c.households_total).toBe(2);
    expect(c.weeks[0]).toMatchObject({ composed: 1 });
    expect(c.weeks[1]).toMatchObject({ composed: 2 });
    expect(c.weeks[2]).toMatchObject({ composed: 0 });
  });

  it('joins each funnel step on the planned week, not the week of the event', async () => {
    const c = await call<{ events: { funnel: { week_start: string; type: string; households: number }[] } }>(`public.admin_weekly_cycle(8)`);
    const at = (week: string, type: string) => c.events.funnel.find((f) => f.week_start === week && f.type === type)?.households ?? 0;
    expect(at(monday, 'plan_confirmed')).toBe(1);
    expect(at(lastMonday, 'plan_confirmed')).toBe(2);
    expect(at(lastMonday, 'shopping_list_built')).toBe(1);
    expect(at(lastMonday, 'coles_list_sent')).toBe(1);
    expect(at(lastMonday, 'shopping_completed')).toBe(1);
    expect(at(monday, 'shopping_completed')).toBe(0);
  });

  it('counts manual effort (swap and delete, not add; accepted edits), ratings, event counts, recipe sources and cuisines', async () => {
    const c = await call<{
      events: { swaps: Record<string, number>; edits: Record<string, number>; ratings: { count: number; avg: number; by_star: Record<string, number> }; counts: Record<string, number> };
      weeks: Record<string, number | string>[];
      cuisines: { households: number; avg: number; max: number };
    }>(`public.admin_weekly_cycle(8)`);
    const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
    expect(sum(c.events.swaps)).toBe(2);
    expect(sum(c.events.edits)).toBe(1);
    expect(c.events.ratings).toMatchObject({ count: 2, by_star: { '4': 1, '5': 1 } });
    expect(Number(c.events.ratings.avg)).toBeCloseTo(4.5);
    expect(c.events.counts.swap).toBe(3);
    expect(c.weeks.reduce((n, w) => n + Number(w.recipes_ai), 0)).toBe(3);
    expect(c.weeks.reduce((n, w) => n + Number(w.recipes_imported), 0)).toBe(1);
    expect(c.weeks.reduce((n, w) => n + Number(w.recipes_user_added), 0)).toBe(1);
    expect(c.cuisines).toMatchObject({ households: 2, max: 2 });
    expect(Number(c.cuisines.avg)).toBeCloseTo(1.5);
  });

  it('filters by household', async () => {
    const c = await call<{ weeks: { composed: number }[]; households_total: number; events: { ratings: { count: number } } }>(`public.admin_weekly_cycle(8, $1)`, [hhB]);
    expect(c.households_total).toBe(1);
    expect(c.weeks[0].composed).toBe(0);
    expect(c.weeks[1].composed).toBe(1);
    expect(c.events.ratings.count).toBe(1);
  });

  it('leaves the events part empty, and does not fail, when product_events is missing', async () => {
    await t.db.query(`ALTER TABLE public.product_events RENAME TO product_events_gone`);
    try {
      const c = await call<{ events: { available: boolean; funnel: unknown[] }; weeks: { composed: number }[] }>(`public.admin_weekly_cycle(8)`);
      expect(c.events).toMatchObject({ available: false, funnel: [] });
      expect(c.weeks[1].composed).toBe(2);
    } finally {
      await t.db.query(`ALTER TABLE public.product_events_gone RENAME TO product_events`);
    }
  });
});

describe('admin_household_summary', () => {
  it('has one entry per household with members, invites, activity, plan, settings, AI use and errors', async () => {
    await t.db.query(`INSERT INTO public.household_invites (household_id, email, invited_by) VALUES ($1, 'someone@example.com', $2)`, [hhA, alice]);
    const rows = await call<Record<string, unknown>[]>(`public.admin_household_summary(now() - interval '7 days')`);
    expect(rows).toHaveLength(2);
    const a = rows.find((r) => r.id === hhA)!;
    expect(a).toMatchObject({ members: 1, pending_invites: 1, settings_complete: true, ai_calls: 4, errors: 3, last3_generation_failed: false });
    expect(a.has_plan_this_week).toBe(true);
    expect(a.last_active).toBeTruthy();
    expect(Number(a.ai_cost_usd)).toBeCloseTo(0.03);
    const b = rows.find((r) => r.id === hhB)!;
    expect(b).toMatchObject({ members: 1, pending_invites: 0, has_plan_this_week: false, last3_generation_failed: true, errors: 1 });
  });

  it('carries no names or emails', async () => {
    const rows = await call<Record<string, unknown>[]>(`public.admin_household_summary(now() - interval '7 days')`);
    expect(JSON.stringify(rows)).not.toMatch(/@|alice|bob/i);
    expect(Object.keys(rows[0]).sort()).toEqual([
      'ai_calls', 'ai_cost_usd', 'errors', 'has_plan_this_week', 'id', 'last3_generation_failed', 'last_active', 'members', 'pending_invites', 'settings_complete',
    ]);
  });

  it('a household whose settings are unset is not complete', async () => {
    const carol = await t.signUp('carol@example.com');
    const hh = (await t.householdOf(carol))!.household_id;
    await t.db.query(`UPDATE public.family_settings SET full_settings = NULL WHERE household_id = $1`, [hh]);
    const rows = await call<{ id: string; settings_complete: boolean }[]>(`public.admin_household_summary(now() - interval '7 days')`);
    expect(rows.find((r) => r.id === hh)!.settings_complete).toBe(false);
  });
});

describe('admin_db_stats and admin_schema_check', () => {
  it('db stats lists the public tables with rows, size and a dead-tuple ratio', async () => {
    const stats = await call<{ table: string; rows: number; size_bytes: number; dead_ratio: number }[]>(`public.admin_db_stats()`);
    expect(stats.map((s) => s.table)).toEqual(expect.arrayContaining(['ai_usage', 'app_errors', 'households', 'product_events', 'health_checks']));
    expect(stats.every((s) => s.size_bytes > 0 && s.dead_ratio >= 0 && s.dead_ratio <= 1)).toBe(true);
  });

  it('schema check reports every migration from 009 to 022 as applied here', async () => {
    const checks = await call<{ migration: string; name: string; applied: boolean }[]>(`public.admin_schema_check()`);
    expect(checks.map((c) => c.migration)).toEqual(['009', '010', '011', '012', '013', '014', '015', '016', '017', '018', '019', '020', '021', '022']);
    expect(checks.filter((c) => !c.applied)).toEqual([]);
  });

  it('schema check notices a missing table', async () => {
    await t.db.query(`ALTER TABLE public.health_checks RENAME TO health_checks_gone`);
    try {
      const checks = await call<{ migration: string; applied: boolean }[]>(`public.admin_schema_check()`);
      expect(checks.filter((c) => !c.applied).map((c) => c.migration)).toEqual(['021']);
    } finally {
      await t.db.query(`ALTER TABLE public.health_checks_gone RENAME TO health_checks`);
    }
  });
});

describe('access', () => {
  const fns = [
    `public.admin_ai_summary(now())`,
    `public.admin_error_groups(now())`,
    `public.admin_weekly_cycle(8)`,
    `public.admin_household_summary(now())`,
    `public.admin_db_stats()`,
    `public.admin_schema_check()`,
  ];

  it.each(fns)('only the service role can run %s', async (fn) => {
    expect(await t.refusal(alice, `SELECT ${fn}`)).toMatch(/permission denied/);
    expect(await t.refusal(null, `SELECT ${fn}`, [], 'anon')).toMatch(/permission denied/);
    expect(await t.refusal(null, `SELECT ${fn}`, [], 'service_role')).toBeNull();
  });
});
