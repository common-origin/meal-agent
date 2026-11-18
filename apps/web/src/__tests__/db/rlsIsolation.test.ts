// @vitest-environment node
/**
 * Household data isolation, enforced by RLS (#67). Two households, one member
 * each, with a row of their own in every household table. Member A must only
 * ever see, add to, change or delete household A's rows, and a signed-out
 * request must see nothing. A loosened USING / WITH CHECK clause, or a
 * dropped policy, fails here.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

interface TableSpec {
  table: string;
  /** The column that says which household a row belongs to. */
  householdColumn: string;
  /** A row for `household` (`uid` is a member of it). */
  row: (household: string, uid: string, tag: string) => Record<string, unknown>;
  /** Members may insert rows here (else inserting is refused for everyone). */
  insertable: boolean;
}

const TABLES: TableSpec[] = [
  { table: 'family_settings', householdColumn: 'household_id', row: () => ({}), insertable: true },
  { table: 'pantry_preferences', householdColumn: 'household_id', row: () => ({}), insertable: true },
  {
    table: 'recipes',
    householdColumn: 'household_id',
    row: (_h, _u, tag) => ({ id: `recipe-${tag}`, title: `Recipe ${tag}`, time_mins: 30, serves: 4, ingredients: '[]' }),
    insertable: true,
  },
  { table: 'meal_plans', householdColumn: 'household_id', row: (_h, _u, tag) => ({ week_start: tag === 'x' ? '2026-12-07' : '2026-11-16', meals: '{}' }), insertable: true },
  { table: 'shopping_lists', householdColumn: 'household_id', row: (_h, _u, tag) => ({ week_start: tag === 'x' ? '2026-12-07' : '2026-11-16', items: '[]' }), insertable: true },
  { table: 'recipe_history', householdColumn: 'household_id', row: (_h, _u, tag) => ({ recipe_id: `recipe-${tag}`, week_start: '2026-11-16' }), insertable: true },
  {
    table: 'household_products',
    householdColumn: 'household_id',
    row: (_h, _u, tag) => ({ ingredient_key: `milk-${tag}`, product_id: `p-${tag}`, name: `Milk ${tag}` }),
    insertable: true,
  },
  {
    table: 'purchase_history',
    householdColumn: 'household_id',
    row: (_h, _u, tag) => ({ order_id: `o-${tag}`, ordered_at: '2026-11-01T00:00:00Z', product_id: `p-${tag}`, name: `Milk ${tag}`, quantity: 1 }),
    insertable: true,
  },
  { table: 'household_favorites', householdColumn: 'household_id', row: (_h, _u, tag) => ({ recipe_id: `recipe-${tag}` }), insertable: true },
  // Written only through claim_api_call (migration 018), so no member can use up the shared quota.
  { table: 'api_usage', householdColumn: 'household_id', row: () => ({ endpoint: 'coles-search' }), insertable: false },
  {
    table: 'ai_usage',
    householdColumn: 'household_id',
    row: (_h, uid) => ({ user_id: uid, task: 'generation', model: 'test', latency_ms: 1, status: 'ok' }),
    insertable: true,
  },
  // Written only through the SECURITY DEFINER functions (migration 015).
  { table: 'household_invites', householdColumn: 'household_id', row: (_h, _u, tag) => ({ email: `invitee-${tag}@example.com` }), insertable: false },
  { table: 'household_members', householdColumn: 'household_id', row: (_h, uid) => ({ user_id: uid }), insertable: false },
];

let t: TestDb;
let alice: string;
let bob: string;
let householdA: string;
let householdB: string;

/** Inserts `spec`'s row for a household as the superuser (bypassing RLS), unless the signup trigger already made it. */
async function seed(spec: TableSpec, household: string, uid: string, tag: string) {
  if (['family_settings', 'pantry_preferences', 'household_members'].includes(spec.table)) return;
  const row = { [spec.householdColumn]: household, ...spec.row(household, uid, tag) };
  const columns = Object.keys(row);
  await t.db.query(
    `INSERT INTO public.${spec.table} (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})`,
    Object.values(row),
  );
}

const countAs = async (uid: string | null, sql: string, params: unknown[] = [], role?: 'authenticated' | 'anon') =>
  (await t.as<{ n: number }>(uid, sql, params, role))[0].n;

beforeAll(async () => {
  t = await createTestDb();
  alice = await t.signUp('alice@example.com');
  bob = await t.signUp('bob@example.com');
  householdA = (await t.householdOf(alice))!.household_id;
  householdB = (await t.householdOf(bob))!.household_id;
  for (const spec of TABLES) {
    await seed(spec, householdA, alice, 'a');
    await seed(spec, householdB, bob, 'b');
  }
}, 60_000);

/** Tables checked by their own describe blocks below, not TABLES. */
const CHECKED_SEPARATELY = ['households', 'signup_invites', 'app_errors', 'product_events', 'health_checks'];

describe('every table is covered', () => {
  it('no public table is missing row level security', async () => {
    const { rows } = await t.db.query<{ relname: string }>(
      `SELECT relname FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND NOT relrowsecurity`,
    );
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  it('every public table is in these isolation tests (add a new one to TABLES)', async () => {
    const { rows } = await t.db.query<{ relname: string }>(
      `SELECT relname FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' ORDER BY relname`,
    );
    const covered = new Set([...TABLES.map((spec) => spec.table), ...CHECKED_SEPARATELY]);
    expect(rows.map((r) => r.relname).filter((name) => !covered.has(name))).toEqual([]);
  });
});

describe.each(TABLES)('$table: a member only reaches their own household', (spec) => {
  it("sees their own household's rows and none of the other's", async () => {
    const col = spec.householdColumn;
    expect(await countAs(alice, `SELECT count(*)::int n FROM public.${spec.table} WHERE ${col} = $1`, [householdA])).toBeGreaterThan(0);
    expect(await countAs(alice, `SELECT count(*)::int n FROM public.${spec.table} WHERE ${col} = $1`, [householdB])).toBe(0);
  });

  it("can't add a row to the other household", async () => {
    const row = { [spec.householdColumn]: householdB, ...spec.row(householdB, alice, 'x') };
    const columns = Object.keys(row);
    const refused = await t.refusal(
      alice,
      `INSERT INTO public.${spec.table} (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})`,
      Object.values(row),
    );
    expect(refused).toMatch(/row-level security|permission denied/);
  });

  it("can't change or delete the other household's rows", async () => {
    const col = spec.householdColumn;
    const before = (await t.db.query<{ n: number }>(`SELECT count(*)::int n FROM public.${spec.table} WHERE ${col} = $1`, [householdB])).rows[0].n;
    const updated = await t.as(alice, `UPDATE public.${spec.table} SET ${col} = ${col} WHERE ${col} = $1 RETURNING 1`, [householdB]);
    const deleted = await t.as(alice, `DELETE FROM public.${spec.table} WHERE ${col} = $1 RETURNING 1`, [householdB]);
    expect(updated).toHaveLength(0);
    expect(deleted).toHaveLength(0);
    const after = (await t.db.query<{ n: number }>(`SELECT count(*)::int n FROM public.${spec.table} WHERE ${col} = $1`, [householdB])).rows[0].n;
    expect(after).toBe(before);
  });

  it("can't move their own row into the other household", async () => {
    const col = spec.householdColumn;
    const inA = async () => (await t.db.query<{ n: number }>(`SELECT count(*)::int n FROM public.${spec.table} WHERE ${col} = $1`, [householdA])).rows[0].n;
    const before = await inA();
    // No WHERE and no RETURNING: either would make Postgres also check the SELECT policy against the
    // moved row, which hides a loosened UPDATE ... WITH CHECK. RLS limits this to Alice's own rows.
    const refused = await t.refusal(alice, `UPDATE public.${spec.table} SET ${col} = $1`, [householdB]);
    // Refused by the UPDATE policy's check, or no UPDATE policy at all (nothing updated); either way nothing moved.
    if (refused) expect(refused).toMatch(/row-level security|duplicate key/);
    expect(await inA()).toBe(before);
  });

  it.runIf(spec.insertable)('can add a row to their own household', async () => {
    const row = { [spec.householdColumn]: householdA, ...spec.row(householdA, alice, 'x') };
    const columns = Object.keys(row);
    // family_settings and pantry_preferences are one row per household, which the signup trigger already made.
    const conflict = ['family_settings', 'pantry_preferences'].includes(spec.table) ? ` ON CONFLICT (household_id) DO NOTHING` : '';
    const refused = await t.refusal(
      alice,
      `INSERT INTO public.${spec.table} (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})${conflict}`,
      Object.values(row),
    );
    expect(refused).toBeNull();
  });

  it('a signed-out request sees nothing', async () => {
    // Either no rows (RLS) or no access to the table at all (household_invites' column grant).
    const refused = await t.refusal(null, `SELECT 1 FROM public.${spec.table}`, [], 'anon');
    if (refused) expect(refused).toMatch(/permission denied/);
    else expect(await countAs(null, `SELECT count(*)::int n FROM public.${spec.table}`, [], 'anon')).toBe(0);
  });
});

describe('households', () => {
  it('a member sees only their own household', async () => {
    const rows = await t.as<{ id: string }>(alice, `SELECT id FROM public.households`);
    expect(rows.map((r) => r.id)).toEqual([householdA]);
  });

  it("can't rename the other household or replace its tokens", async () => {
    expect(await t.as(alice, `UPDATE public.households SET name = 'hijacked', ics_token = gen_random_uuid() WHERE id = $1 RETURNING 1`, [householdB])).toHaveLength(0);
  });

  it("can't create or delete households directly", async () => {
    expect(await t.refusal(alice, `INSERT INTO public.households (name) VALUES ('mine')`)).toMatch(/row-level security/);
    expect(await t.as(alice, `DELETE FROM public.households WHERE id = $1 RETURNING 1`, [householdA])).toHaveLength(0);
  });

  it('a signed-out request sees no households', async () => {
    expect(await countAs(null, `SELECT count(*)::int n FROM public.households`, [], 'anon')).toBe(0);
  });
});

describe('signup_invites', () => {
  it('no signed-in user can read, add or remove invites (SQL editor only)', async () => {
    expect(await countAs(alice, `SELECT count(*)::int n FROM public.signup_invites`)).toBe(0);
    expect(await t.refusal(alice, `INSERT INTO public.signup_invites (email) VALUES ('friend@example.com')`)).toMatch(/row-level security/);
    expect(await t.as(alice, `DELETE FROM public.signup_invites RETURNING 1`)).toHaveLength(0);
  });
});

describe('ai_usage', () => {
  it("can't be logged as someone else", async () => {
    expect(
      await t.refusal(alice, `INSERT INTO public.ai_usage (user_id, household_id, task, model, latency_ms, status) VALUES ($1, $2, 'generation', 'test', 1, 'ok')`, [bob, householdA]),
    ).toMatch(/row-level security/);
  });
});

describe('app_errors (admin dashboard telemetry)', () => {
  const insertRow = `INSERT INTO public.app_errors (release, source, kind, fingerprint, household_id) VALUES ('dev', 'server', 'Error', 'f', $1)`;

  it('is service-role only: no member, signed-in or not, can read, add, change or remove rows', async () => {
    await t.db.query(insertRow, [householdA]);
    expect(await countAs(alice, `SELECT count(*)::int n FROM public.app_errors`)).toBe(0);
    expect(await countAs(null, `SELECT count(*)::int n FROM public.app_errors`, [], 'anon')).toBe(0);
    expect(await t.refusal(alice, insertRow, [householdA])).toMatch(/row-level security/);
    expect(await t.as(alice, `UPDATE public.app_errors SET label = 'x' RETURNING 1`)).toHaveLength(0);
    expect(await t.as(alice, `DELETE FROM public.app_errors RETURNING 1`)).toHaveLength(0);
    expect((await t.as<{ n: number }>(null, `SELECT count(*)::int n FROM public.app_errors`, [], 'service_role'))[0].n).toBeGreaterThan(0);
  });

  it('keeps the row, unlinked, when the household is deleted', async () => {
    const owner = await t.signUp('carol@example.com');
    const household = (await t.householdOf(owner))!.household_id;
    await t.db.query(`INSERT INTO public.app_errors (release, source, kind, fingerprint, household_id) VALUES ('dev', 'route', 'Error', 'unlink-me', $1)`, [household]);
    await t.db.query(`DELETE FROM public.households WHERE id = $1`, [household]);
    const { rows } = await t.db.query<{ household_id: string | null }>(`SELECT household_id FROM public.app_errors WHERE fingerprint = 'unlink-me'`);
    expect(rows).toEqual([{ household_id: null }]);
  });

  it('purge_telemetry deletes only rows older than 90 days, and only the service role may call it', async () => {
    await t.db.query(
      `INSERT INTO public.app_errors (release, source, kind, fingerprint, created_at) VALUES ('dev', 'server', 'Error', 'old-row', now() - interval '91 days'), ('dev', 'server', 'Error', 'new-row', now() - interval '89 days')`,
    );
    expect(await t.refusal(alice, `SELECT public.purge_telemetry()`)).toMatch(/permission denied/);
    const [{ n }] = await t.as<{ n: number }>(null, `SELECT public.purge_telemetry() AS n`, [], 'service_role');
    expect(n).toBeGreaterThanOrEqual(1);
    const { rows } = await t.db.query<{ fingerprint: string }>(`SELECT fingerprint FROM public.app_errors WHERE fingerprint IN ('old-row', 'new-row')`);
    expect(rows.map((r) => r.fingerprint)).toEqual(['new-row']);
  });
});

describe('product_events (admin dashboard telemetry)', () => {
  const insertRow = `INSERT INTO public.product_events (household_id, type, props, release) VALUES ($1, 'plan_confirmed', '{"weekStart":"2026-11-16"}', 'dev')`;

  it('is service-role only: no member, signed-in or not, can read, add, change or remove rows', async () => {
    await t.db.query(insertRow, [householdA]);
    expect(await countAs(alice, `SELECT count(*)::int n FROM public.product_events`)).toBe(0);
    expect(await countAs(null, `SELECT count(*)::int n FROM public.product_events`, [], 'anon')).toBe(0);
    expect(await t.refusal(alice, insertRow, [householdA])).toMatch(/row-level security/);
    expect(await t.as(alice, `UPDATE public.product_events SET type = 'x' RETURNING 1`)).toHaveLength(0);
    expect(await t.as(alice, `DELETE FROM public.product_events RETURNING 1`)).toHaveLength(0);
    expect((await t.as<{ n: number }>(null, `SELECT count(*)::int n FROM public.product_events`, [], 'service_role'))[0].n).toBeGreaterThan(0);
  });

  it('keeps the row, unlinked, when the household is deleted', async () => {
    const owner = await t.signUp('dave@example.com');
    const household = (await t.householdOf(owner))!.household_id;
    await t.db.query(`INSERT INTO public.product_events (household_id, type, release) VALUES ($1, 'unlink-me', 'dev')`, [household]);
    await t.db.query(`DELETE FROM public.households WHERE id = $1`, [household]);
    const { rows } = await t.db.query<{ household_id: string | null }>(`SELECT household_id FROM public.product_events WHERE type = 'unlink-me'`);
    expect(rows).toEqual([{ household_id: null }]);
  });

  it('purge_telemetry keeps product_events for 400 days and app_errors for 90', async () => {
    await t.db.query(
      `INSERT INTO public.product_events (type, release, created_at) VALUES ('old-ev', 'dev', now() - interval '401 days'), ('new-ev', 'dev', now() - interval '399 days'), ('mid-ev', 'dev', now() - interval '100 days')`,
    );
    await t.db.query(`INSERT INTO public.app_errors (release, source, kind, fingerprint, created_at) VALUES ('dev', 'server', 'Error', 'old-err-2', now() - interval '91 days')`);
    await t.as(null, `SELECT public.purge_telemetry()`, [], 'service_role');
    const events = await t.db.query<{ type: string }>(`SELECT type FROM public.product_events WHERE type IN ('old-ev', 'new-ev', 'mid-ev') ORDER BY type`);
    expect(events.rows.map((r) => r.type)).toEqual(['mid-ev', 'new-ev']);
    const errors = await t.db.query(`SELECT 1 FROM public.app_errors WHERE fingerprint = 'old-err-2'`);
    expect(errors.rows).toHaveLength(0);
  });
});

describe('health_checks (admin dashboard telemetry)', () => {
  const insertRow = `INSERT INTO public.health_checks (release, ok, checks, total_latency_ms) VALUES ('dev', true, '{"database":{"ok":true}}', 10)`;

  it('is service-role only: no member, signed-in or not, can read, add, change or remove rows', async () => {
    await t.db.query(insertRow);
    expect(await countAs(alice, `SELECT count(*)::int n FROM public.health_checks`)).toBe(0);
    expect(await countAs(null, `SELECT count(*)::int n FROM public.health_checks`, [], 'anon')).toBe(0);
    expect(await t.refusal(alice, insertRow)).toMatch(/row-level security/);
    expect(await t.as(alice, `UPDATE public.health_checks SET ok = false RETURNING 1`)).toHaveLength(0);
    expect(await t.as(alice, `DELETE FROM public.health_checks RETURNING 1`)).toHaveLength(0);
    expect((await t.as<{ n: number }>(null, `SELECT count(*)::int n FROM public.health_checks`, [], 'service_role'))[0].n).toBeGreaterThan(0);
  });

  it('purge_telemetry keeps health_checks 90 days', async () => {
    await t.db.query(
      `INSERT INTO public.health_checks (release, ok, created_at) VALUES ('old-hc', true, now() - interval '91 days'), ('new-hc', true, now() - interval '89 days')`,
    );
    await t.as(null, `SELECT public.purge_telemetry()`, [], 'service_role');
    const checks = await t.db.query<{ release: string }>(`SELECT release FROM public.health_checks WHERE release IN ('old-hc', 'new-hc')`);
    expect(checks.rows.map((r) => r.release)).toEqual(['new-hc']);
  });
});
