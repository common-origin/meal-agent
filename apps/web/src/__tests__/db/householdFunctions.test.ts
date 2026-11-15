// @vitest-environment node
/**
 * The database functions behind household invites and membership (015),
 * favourites (016), account deletion (017), the AI spend total (014) and
 * the shared Coles lookup quota (018),
 * run against the real migrations (#67).
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

let t: TestDb;
let n = 0;
/** A fresh, uniquely named user with their own household. */
const newUser = (name: string) => t.signUp(`${name}-${++n}@example.com`);
const emailOf = async (uid: string) => (await t.db.query<{ email: string }>(`SELECT email FROM auth.users WHERE id = $1`, [uid])).rows[0].email;
const count = async (sql: string, params: unknown[] = []) => (await t.db.query<{ n: number }>(sql, params)).rows[0].n;
const invite = async (owner: string, email: string) =>
  (await t.as<{ id: string; token: string; email: string }>(owner, `SELECT * FROM public.create_household_invite($1)`, [email]))[0];

beforeAll(async () => {
  t = await createTestDb();
}, 60_000);

describe('household invites (015)', () => {
  let owner: string;
  let household: string;
  beforeEach(async () => {
    owner = await newUser('owner');
    household = (await t.householdOf(owner))!.household_id;
  });

  it('a new user with a pending invite joins that household at signup, without signup_invites', async () => {
    const inv = await invite(owner, `  New-${n}@Example.com `);
    expect(inv.email).toBe(`new-${n}@example.com`);
    expect(await count(`SELECT count(*)::int n FROM public.signup_invites WHERE email = $1`, [inv.email])).toBe(0);
    const { rows } = await t.db.query<{ id: string }>(`INSERT INTO auth.users (email) VALUES ($1) RETURNING id`, [inv.email]);
    expect(await t.householdOf(rows[0].id)).toEqual({ household_id: household, role: 'member' });
    expect(await count(`SELECT count(*)::int n FROM public.households`)).toBe(await count(`SELECT count(DISTINCT household_id)::int n FROM public.household_members`));
  });

  it('a cancelled or expired invite no longer lets the email sign up, and strangers never could', async () => {
    const cancelled = await invite(owner, `cancelled-${n}@example.com`);
    await t.as(owner, `SELECT public.cancel_household_invite($1)`, [cancelled.id]);
    const expired = await invite(owner, `expired-${n}@example.com`);
    await t.db.query(`UPDATE public.household_invites SET expires_at = now() - interval '1 day' WHERE id = $1`, [expired.id]);
    for (const email of [cancelled.email, expired.email, `stranger-${n}@example.com`]) {
      await expect(t.db.query(`INSERT INTO auth.users (email) VALUES ($1)`, [email])).rejects.toThrow(/signup_not_invited/);
    }
  });

  it('an existing user accepts with a matching email, and their sole household and its data go', async () => {
    const joiner = await newUser('joiner');
    const old = (await t.householdOf(joiner))!.household_id;
    await t.db.query(`INSERT INTO public.meal_plans (household_id, week_start, meals) VALUES ($1, '2026-11-16', '{}')`, [old]);
    const inv = await invite(owner, await emailOf(joiner));
    const preview = (await t.as<{ status: string; email_matches: boolean; sole_member: boolean; inviter_email: string }>(joiner, `SELECT * FROM public.household_invite_preview($1)`, [inv.token]))[0];
    expect(preview).toMatchObject({ status: 'valid', email_matches: true, sole_member: true, inviter_email: await emailOf(owner) });

    const outsider = await newUser('outsider');
    expect(await t.refusal(outsider, `SELECT public.accept_household_invite($1)`, [inv.token])).toMatch(/household:email_mismatch/);

    await t.as(joiner, `SELECT public.accept_household_invite($1)`, [inv.token]);
    expect(await t.householdOf(joiner)).toEqual({ household_id: household, role: 'member' });
    expect(await count(`SELECT count(*)::int n FROM public.households WHERE id = $1`, [old])).toBe(0);
    expect(await count(`SELECT count(*)::int n FROM public.meal_plans WHERE household_id = $1`, [old])).toBe(0);
    expect(await t.refusal(outsider, `SELECT public.accept_household_invite($1)`, [inv.token])).toMatch(/household:already_accepted/);
  });

  it('only the owner invites or cancels, within six people, and not current members', async () => {
    const member = await newUser('member');
    await t.as(member, `SELECT public.accept_household_invite($1)`, [(await invite(owner, await emailOf(member))).token]);
    expect(await t.refusal(member, `SELECT * FROM public.create_household_invite('x@example.com')`)).toMatch(/household:not_owner/);
    expect(await t.refusal(owner, `SELECT * FROM public.create_household_invite($1)`, [await emailOf(member)])).toMatch(/household:already_member/);
    expect(await t.refusal(owner, `SELECT * FROM public.create_household_invite('not-an-email')`)).toMatch(/household:invalid_email/);
    const pending = await invite(owner, `p1-${n}@example.com`);
    expect(await t.refusal(member, `SELECT public.cancel_household_invite($1)`, [pending.id])).toMatch(/household:not_found/);
    for (const i of [2, 3, 4]) await invite(owner, `p${i}-${n}@example.com`); // 2 members + 4 invites = 6
    expect(await t.refusal(owner, `SELECT * FROM public.create_household_invite('seventh@example.com')`)).toMatch(/household:full/);
  });

  it("members can list the household's invites but not read their tokens", async () => {
    await invite(owner, `listed-${n}@example.com`);
    expect((await t.as(owner, `SELECT email FROM public.household_invites`)).length).toBe(1);
    expect(await t.refusal(owner, `SELECT token FROM public.household_invites`)).toMatch(/permission denied/);
  });
});

describe('membership (015)', () => {
  it('one household per user, and memberships change only through the functions', async () => {
    const a = await newUser('a');
    const b = await newUser('b');
    const hb = (await t.householdOf(b))!.household_id;
    await expect(t.db.query(`INSERT INTO public.household_members (household_id, user_id) VALUES ($1, $2)`, [hb, a])).rejects.toThrow(/duplicate key/);
    expect(await t.refusal(b, `INSERT INTO public.household_members (household_id, user_id) VALUES ($1, $2)`, [hb, a])).toMatch(/row-level security/);
    expect(await t.as(b, `DELETE FROM public.household_members WHERE user_id = $1 RETURNING 1`, [b])).toHaveLength(0);
  });

  it('removing a member gives them a new household; the owner leaving hands it over; the only member stays', async () => {
    const owner = await newUser('owner');
    const household = (await t.householdOf(owner))!.household_id;
    const [m1, m2] = [await newUser('m1'), await newUser('m2')];
    for (const m of [m1, m2]) await t.as(m, `SELECT public.accept_household_invite($1)`, [(await invite(owner, await emailOf(m))).token]);

    expect(await t.refusal(m1, `SELECT public.remove_household_member($1)`, [m2])).toMatch(/household:not_owner/);
    await t.as(owner, `SELECT public.remove_household_member($1)`, [m2]);
    const fresh = (await t.householdOf(m2))!;
    expect(fresh).toMatchObject({ role: 'owner' });
    expect(fresh.household_id).not.toBe(household);
    expect((await t.db.query(`SELECT full_settings FROM public.family_settings WHERE household_id = $1`, [fresh.household_id])).rows[0]).toEqual({ full_settings: null });

    await t.as(owner, `SELECT public.remove_household_member($1)`, [owner]);
    expect(await t.householdOf(m1)).toEqual({ household_id: household, role: 'owner' });
    expect(await t.refusal(m1, `SELECT public.remove_household_member($1)`, [m1])).toMatch(/household:only_member/);
  });

  it('only owners update the household row', async () => {
    const owner = await newUser('owner');
    const household = (await t.householdOf(owner))!.household_id;
    const member = await newUser('member');
    await t.as(member, `SELECT public.accept_household_invite($1)`, [(await invite(owner, await emailOf(member))).token]);
    expect(await t.as(member, `UPDATE public.households SET extension_token = gen_random_uuid() WHERE id = $1 RETURNING 1`, [household])).toHaveLength(0);
    expect(await t.as(owner, `UPDATE public.households SET extension_token = gen_random_uuid() WHERE id = $1 RETURNING 1`, [household])).toHaveLength(1);
  });

  it("the functions' helpers can't be called by users, and signed-out users can't call the functions", async () => {
    const u = await newUser('u');
    expect(await t.refusal(u, `SELECT public._leave_household($1)`, [u])).toMatch(/permission denied/);
    expect(await t.refusal(u, `SELECT public._create_household_for($1)`, [u])).toMatch(/permission denied/);
    for (const fn of ['household_member_list()', `create_household_invite('a@b.co')`, 'delete_my_account()']) {
      expect(await t.refusal(null, `SELECT public.${fn}`, [], 'anon')).toMatch(/permission denied/);
    }
  });
});

describe('favourites (016)', () => {
  it('records who added a favourite, and keeps it (unattributed) when they delete their account', async () => {
    const owner = await newUser('owner');
    const household = (await t.householdOf(owner))!.household_id;
    const member = await newUser('member');
    await t.as(member, `SELECT public.accept_household_invite($1)`, [(await invite(owner, await emailOf(member))).token]);
    await t.as(member, `INSERT INTO public.household_favorites (household_id, recipe_id) VALUES ($1, 'r1')`, [household]);
    expect((await t.db.query(`SELECT created_by FROM public.household_favorites WHERE household_id = $1`, [household])).rows[0]).toEqual({ created_by: member });
    await t.as(member, `SELECT public.delete_my_account()`);
    expect((await t.db.query(`SELECT created_by FROM public.household_favorites WHERE household_id = $1`, [household])).rows[0]).toEqual({ created_by: null });
  });
});

describe('delete my account (017)', () => {
  it('the only member: the account, household, its data, AI log and signup invite all go', async () => {
    const u = await newUser('solo');
    const h = (await t.householdOf(u))!.household_id;
    const email = await emailOf(u);
    await t.db.query(`INSERT INTO public.meal_plans (household_id, week_start, meals) VALUES ($1, '2026-11-16', '{}')`, [h]);
    await t.db.query(`INSERT INTO public.ai_usage (user_id, household_id, task, model, latency_ms, status) VALUES ($1, $2, 'generation', 'm', 1, 'ok')`, [u, h]);
    await t.as(u, `SELECT public.delete_my_account()`);
    expect(await count(`SELECT count(*)::int n FROM auth.users WHERE id = $1`, [u])).toBe(0);
    expect(await count(`SELECT count(*)::int n FROM public.households WHERE id = $1`, [h])).toBe(0);
    expect(await count(`SELECT count(*)::int n FROM public.meal_plans WHERE household_id = $1`, [h])).toBe(0);
    expect(await count(`SELECT count(*)::int n FROM public.ai_usage WHERE user_id = $1`, [u])).toBe(0);
    expect(await count(`SELECT count(*)::int n FROM public.signup_invites WHERE email = $1`, [email])).toBe(0);
  });

  it("the owner of a shared household: it stays, passes on, and keeps its invites", async () => {
    const owner = await newUser('owner');
    const h = (await t.householdOf(owner))!.household_id;
    const member = await newUser('member');
    await t.as(member, `SELECT public.accept_household_invite($1)`, [(await invite(owner, await emailOf(member))).token]);
    const pending = await invite(owner, `pending-${n}@example.com`);
    await t.as(owner, `SELECT public.delete_my_account()`);
    expect(await t.householdOf(member)).toEqual({ household_id: h, role: 'owner' });
    expect((await t.db.query(`SELECT invited_by FROM public.household_invites WHERE id = $1`, [pending.id])).rows[0]).toEqual({ invited_by: null });
  });

  it('pending invites to the deleted email are removed', async () => {
    const inviter = await newUser('inviter');
    const leaver = await newUser('leaver');
    await invite(inviter, await emailOf(leaver));
    const email = await emailOf(leaver);
    await t.as(leaver, `SELECT public.delete_my_account()`);
    expect(await count(`SELECT count(*)::int n FROM public.household_invites WHERE email = $1`, [email])).toBe(0);
  });

  it('refuses without a signed-in user', async () => {
    expect(await t.refusal(null, `SELECT public.delete_my_account()`, [], 'service_role')).toMatch(/account:not_signed_in/);
  });
});

describe('AI spend total (014)', () => {
  it("only the service role can read everyone's spend", async () => {
    const u = await newUser('spender');
    await t.db.query(`INSERT INTO public.ai_usage (user_id, task, model, latency_ms, status, cost_usd) VALUES ($1, 'generation', 'm', 1, 'ok', 0.25), ($1, 'generation', 'm', 1, 'ok', NULL)`, [u]);
    const spent = await t.as<{ total: string }>(null, `SELECT public.ai_spend_since(now() - interval '1 day') AS total`, [], 'service_role');
    expect(Number(spent[0].total)).toBeCloseTo(0.25);
    expect(await t.refusal(u, `SELECT public.ai_spend_since(now())`)).toMatch(/permission denied/);
    expect(await t.refusal(null, `SELECT public.ai_spend_since(now())`, [], 'anon')).toMatch(/permission denied/);
  });
});

describe('shared Coles lookup quota (018)', () => {
  const claim = (household: string, limit: number, since = '2026-11-01T00:00:00Z', endpoint = 'quota-test') =>
    t.as<{ granted: boolean; used: number }>(null, `SELECT * FROM public.claim_api_call($1, $2, $3, $4)`, [household, endpoint, limit, since], 'service_role');

  it('counts every household toward one total, and refuses at the limit without counting', async () => {
    const a = (await t.householdOf(await newUser('quota-a')))!.household_id;
    const b = (await t.householdOf(await newUser('quota-b')))!.household_id;
    expect(await claim(a, 3, '2000-01-01T00:00:00Z')).toEqual([{ granted: true, used: 1 }]);
    expect(await claim(b, 3, '2000-01-01T00:00:00Z')).toEqual([{ granted: true, used: 2 }]);
    expect(await claim(a, 3, '2000-01-01T00:00:00Z')).toEqual([{ granted: true, used: 3 }]);
    expect(await claim(b, 3, '2000-01-01T00:00:00Z')).toEqual([{ granted: false, used: 3 }]);
    expect(await count(`SELECT count(*)::int n FROM public.api_usage WHERE endpoint = 'quota-test'`)).toBe(3);
    const total = await t.as<{ n: number }>(null, `SELECT public.api_calls_since('quota-test', '2000-01-01T00:00:00Z') n`, [], 'service_role');
    expect(total[0].n).toBe(3);
  });

  it("doesn't count calls from before the month, or to other endpoints", async () => {
    const h = (await t.householdOf(await newUser('quota-c')))!.household_id;
    await t.db.query(`INSERT INTO public.api_usage (household_id, endpoint, "timestamp") VALUES ($1, 'quota-old', now() - interval '40 days')`, [h]);
    await t.db.query(`INSERT INTO public.api_usage (household_id, endpoint) VALUES ($1, 'other-endpoint')`, [h]);
    expect(await claim(h, 1, new Date(Date.now() - 86_400_000).toISOString(), 'quota-old')).toEqual([{ granted: true, used: 1 }]);
  });

  it('only the service role can claim or count calls, and members can no longer log them directly', async () => {
    const u = await newUser('quota-d');
    const h = (await t.householdOf(u))!.household_id;
    expect(await t.refusal(u, `SELECT * FROM public.claim_api_call($1, 'coles-search', 1000, now())`, [h])).toMatch(/permission denied/);
    expect(await t.refusal(null, `SELECT * FROM public.claim_api_call($1, 'coles-search', 1000, now())`, [h], 'anon')).toMatch(/permission denied/);
    expect(await t.refusal(u, `SELECT public.api_calls_since('coles-search', now())`)).toMatch(/permission denied/);
    expect(await t.refusal(u, `INSERT INTO public.api_usage (household_id, endpoint) VALUES ($1, 'coles-search')`, [h])).toMatch(/row-level security/);
  });
});
