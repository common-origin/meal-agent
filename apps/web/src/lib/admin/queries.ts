/**
 * What the /admin page reads (#249). Server only: every query uses the
 * service role, after the page has checked ADMIN_EMAILS.
 *
 * Aggregates come from the migration 022 SQL functions, each returning one
 * jsonb value, so nothing is cut off at Supabase's 1,000-row request limit.
 * The one place rows are read directly (health checks, for the uptime strip,
 * up to 30 days of 15-minute rows) pages through readAllPages.
 *
 * Sections load with Promise.allSettled: one that fails (a migration not run
 * yet) shows "couldn't load" and the rest still render.
 */

import { createAdminClient } from '@/lib/supabase/server';
import { readAllPages } from '@/lib/supabase/paging';
import { readColesQuota } from '@/lib/coles/quota';
import { BILLING_ERROR_CODES } from '@/lib/ai/run';
import { dailySpendCapUsd, startOfUtcDay } from '@/lib/ai/usage';
import { isHeartbeatStale, lastIncident, summariseUptime, SLOT_MS } from '@/lib/health/uptime';
import { release } from '@/lib/telemetry/release';
import { computeAttention, failingSince } from './attention';
import { projectMonthEnd, rangeStart, resolveHousehold, sortHouseholds, toHouseholdRow } from './format';
import type {
  AiSummary,
  AttentionItem,
  CostData,
  DbStat,
  ErrorGroup,
  HealthCheckRow,
  HouseholdRow,
  HouseholdRowRaw,
  Loaded,
  Range,
  SchemaCheck,
  StatusData,
  UptimeView,
  WeeklyCycle,
} from './types';

const DAY_MS = 86_400_000;

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await createAdminClient().rpc(name as never, args as never);
  if (error) throw new Error(`${name}: ${error.message}`);
  return data as unknown as T;
}

const HEALTH_COLUMNS = 'created_at, ok, release, checks, total_latency_ms';

async function latestHealthRow(): Promise<HealthCheckRow | null> {
  const { data, error } = await createAdminClient().from('health_checks').select(HEALTH_COLUMNS).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`health_checks: ${error.message}`);
  return (data as unknown as HealthCheckRow | null) ?? null;
}

/**
 * When the first health check was recorded. Only sets the "monitoring began"
 * caption and where uptime starts, so it's best effort: on any failure it's
 * null and the section shows the whole range rather than "couldn't load".
 */
async function earliestHealthTime(): Promise<number | null> {
  try {
    const { data, error } = await createAdminClient().from('health_checks').select('created_at').order('created_at', { ascending: true }).limit(1).maybeSingle();
    if (error) return null;
    const time = data ? new Date((data as { created_at: string }).created_at).getTime() : NaN;
    return Number.isNaN(time) ? null : time;
  } catch {
    return null;
  }
}

/** The full IDs of every household the signed-in admin belongs to, for marking "You". Best effort: empty on any failure. */
async function viewerHouseholdIds(userId: string): Promise<Set<string>> {
  try {
    const { data, error } = await createAdminClient().from('household_members').select('household_id').eq('user_id', userId);
    if (error || !data) return new Set();
    return new Set((data as { household_id: string }[]).map((row) => row.household_id));
  } catch {
    return new Set();
  }
}

async function healthRowsSince(since: Date): Promise<{ created_at: string; ok: boolean }[]> {
  const supabase = createAdminClient();
  return readAllPages<{ created_at: string; ok: boolean }>((from, to) =>
    supabase.from('health_checks').select('created_at, ok').gte('created_at', since.toISOString()).order('created_at', { ascending: true }).order('id').range(from, to)
  );
}

export function uptimeView(rows: { created_at: string; ok: boolean }[], from: Date, to: Date, monitoringSince: number | null = null): UptimeView {
  const summary = summariseUptime(rows, from, to);
  return {
    from: from.getTime(),
    to: to.getTime(),
    slots: summary.slots,
    uptimePct: summary.uptimePct,
    noDataShare: summary.noDataShare,
    okSlots: summary.okSlots,
    failingSlots: summary.failingSlots,
    noDataSlots: summary.noDataSlots,
    possibleOutages: summary.possibleOutages,
    outageNow: summary.outageNow,
    lastIncident: lastIncident(summary.slots),
    monitoringSince,
  };
}

export async function loadStatus(range: Range, now: Date): Promise<StatusData> {
  const rangeFrom = rangeStart(range, now);
  const [latest, rows, earliest] = await Promise.all([latestHealthRow(), healthRowsSince(rangeFrom), earliestHealthTime()]);
  // Monitoring began after the range did: start there (on its slot), so the time before it counts as neither down nor "no data".
  const began = earliest === null ? null : Math.floor(earliest / SLOT_MS) * SLOT_MS;
  const cutShort = began !== null && began > rangeFrom.getTime();
  return {
    latest,
    heartbeatStale: isHeartbeatStale(latest?.created_at, now),
    uptime: uptimeView(rows, cutShort ? new Date(began) : rangeFrom, now, cutShort ? began : null),
    deployedRelease: release(),
  };
}

export const loadErrors = (since: Date, householdId: string | null) =>
  rpc<ErrorGroup[]>('admin_error_groups', { p_since: since.toISOString(), p_household: householdId });

export const loadAi = (since: Date, householdId: string | null) =>
  rpc<AiSummary>('admin_ai_summary', { p_since: since.toISOString(), p_household: householdId, p_billing_codes: [...BILLING_ERROR_CODES] });

export const loadCycle = (householdId: string | null) => rpc<WeeklyCycle>('admin_weekly_cycle', { p_weeks: 8, p_household: householdId });

export const loadHouseholdsRaw = (since: Date) => rpc<HouseholdRowRaw[]>('admin_household_summary', { p_since: since.toISOString() });

export async function loadDatabase(): Promise<{ stats: DbStat[]; schema: SchemaCheck[] }> {
  const [stats, schema] = await Promise.all([rpc<DbStat[]>('admin_db_stats'), rpc<SchemaCheck[]>('admin_schema_check')]);
  return { stats, schema };
}

async function spendSince(sinceIso: string): Promise<number> {
  const value = Number(await rpc<number | string | null>('ai_spend_since', { since: sinceIso }));
  if (!Number.isFinite(value)) throw new Error('ai_spend_since returned a non-number');
  return value;
}

export async function loadCost(now: Date): Promise<CostData> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const [spendTodayUsd, monthToDateUsd, coles] = await Promise.all([spendSince(startOfUtcDay(now)), spendSince(monthStart), readColesQuota(now)]);
  const projection = projectMonthEnd(monthToDateUsd, now);
  return {
    spendTodayUsd,
    capUsd: dailySpendCapUsd(),
    monthToDateUsd,
    projectedMonthUsd: projection.projectedUsd,
    daysElapsed: projection.daysElapsed,
    daysInMonth: projection.daysInMonth,
    coles: coles ? { used: coles.used, limit: coles.limit, remaining: coles.remaining, month: coles.month } : null,
  };
}

/**
 * The inputs for "Needs attention" are read on their own, not taken from the
 * sections: the rules look at the last 24 hours or 7 days across every
 * household, whatever range or household the page is filtered to.
 */
export async function loadAttention(
  now: Date,
  shared: {
    /** Already being loaded for the Households, Cost and Database sections: shared, not read again. */
    households: Promise<HouseholdRowRaw[] | null>;
    cost: Promise<CostData>;
    database: Promise<{ stats: DbStat[]; schema: SchemaCheck[] }>;
  }
): Promise<AttentionItem[]> {
  const since24h = new Date(now.getTime() - DAY_MS);
  const since7d = new Date(now.getTime() - 7 * DAY_MS);
  const recent = new Date(now.getTime() - 6 * 3_600_000);
  const names = ['health', 'errors', 'ai', 'cost and quota', 'migrations', 'households'] as const;
  const results = await Promise.allSettled([
    Promise.all([latestHealthRow(), healthRowsSince(recent)]),
    loadErrors(since7d, null),
    loadAi(since24h, null),
    shared.cost,
    shared.database,
    shared.households,
  ]);
  const value = <T,>(i: number): T | null => (results[i].status === 'fulfilled' ? ((results[i] as PromiseFulfilledResult<T>).value ?? null) : null);
  const cost = value<CostData>(3);
  const unavailable = names.filter((_, i) => value(i) === null);

  const health = value<[HealthCheckRow | null, { created_at: string; ok: boolean }[]]>(0);
  const attentionHealth = health
    ? {
        latest: health[0],
        heartbeatStale: isHeartbeatStale(health[0]?.created_at, now),
        outageNow: summariseUptime(health[1], new Date(now.getTime() - 6 * 3_600_000 - SLOT_MS), now).outageNow,
        failingSince: failingSince(health[1]),
      }
    : null;

  return computeAttention({
    now,
    health: attentionHealth,
    errors7d: value<ErrorGroup[]>(1),
    ai24h: value<AiSummary>(2),
    spend: cost ? { todayUsd: cost.spendTodayUsd, capUsd: cost.capUsd } : null,
    coles: cost?.coles ?? null,
    schema: value<{ stats: DbStat[]; schema: SchemaCheck[] }>(4)?.schema ?? null,
    households: value<HouseholdRowRaw[]>(5),
    unavailable: unavailable.filter((name) => !(name === 'cost and quota' && cost !== null)),
  });
}

export interface DashboardData {
  range: Range;
  /** The short ID of the household the page is filtered to, if any. */
  household: string | null;
  generatedAt: string;
  attention: Loaded<AttentionItem[]>;
  status: Loaded<StatusData>;
  errors: Loaded<ErrorGroup[]>;
  ai: Loaded<AiSummary>;
  cost: Loaded<CostData>;
  households: Loaded<HouseholdRow[]>;
  cycle: Loaded<WeeklyCycle>;
  database: Loaded<{ stats: DbStat[]; schema: SchemaCheck[] }>;
}

const HINTS = {
  attention: 'is migration 022 applied?',
  status: 'is migration 021 applied?',
  errors: 'is migration 019 or 022 applied?',
  ai: 'is migration 022 applied?',
  cost: 'is migration 014 or 018 applied?',
  households: 'is migration 022 applied?',
  cycle: 'is migration 022 applied?',
  database: 'is migration 022 applied?',
};

function loaded<T>(result: PromiseSettledResult<T>, hint: string, section: string): Loaded<T> {
  if (result.status === 'fulfilled') return { ok: true, data: result.value };
  console.warn(`admin: the ${section} section couldn't load:`, result.reason instanceof Error ? result.reason.message : String(result.reason));
  return { ok: false, hint };
}

export async function loadDashboard(params: { range: Range; household: string | null; viewerUserId?: string | null }, now: Date = new Date()): Promise<DashboardData> {
  const since = rangeStart(params.range, now);

  // The household list feeds three sections and resolves ?household=; only a filter makes the others wait for it.
  const householdsResult = Promise.allSettled([loadHouseholdsRaw(since)]).then(([result]) => result);
  const settledHouseholds = params.household ? await householdsResult : null;
  const householdId = resolveHousehold(params.household, settledHouseholds?.status === 'fulfilled' ? settledHouseholds.value : []);

  const viewerPromise = params.viewerUserId ? viewerHouseholdIds(params.viewerUserId) : Promise.resolve(new Set<string>());

  // Cost and database are also what the attention rules need: loaded once, shared.
  const costPromise = loadCost(now);
  const databasePromise = loadDatabase();

  const [status, errors, ai, cost, cycle, database, attention, households] = await Promise.allSettled([
    loadStatus(params.range, now),
    loadErrors(since, householdId),
    loadAi(since, householdId),
    costPromise,
    loadCycle(householdId),
    databasePromise,
    loadAttention(now, {
      households: householdsResult.then((result) => (result.status === 'fulfilled' ? result.value : null)),
      cost: costPromise,
      database: databasePromise,
    }),
    householdsResult,
  ]);
  // householdsResult never rejects (it wraps allSettled), so the outer result is always fulfilled.
  const householdsSettled = households.status === 'fulfilled' ? households.value : households;
  const viewerHouseholds = await viewerPromise;
  const householdsLoaded: Loaded<HouseholdRow[]> =
    householdsSettled.status === 'fulfilled'
      ? { ok: true, data: sortHouseholds(householdsSettled.value.map((row) => toHouseholdRow(row, viewerHouseholds))) }
      : loaded<HouseholdRow[]>(householdsSettled, HINTS.households, 'households');

  return {
    range: params.range,
    household: householdId ? params.household : null,
    generatedAt: now.toISOString(),
    attention: loaded(attention, HINTS.attention, 'attention'),
    status: loaded(status, HINTS.status, 'status'),
    errors: loaded(errors, HINTS.errors, 'errors'),
    ai: loaded(ai, HINTS.ai, 'ai'),
    cost: loaded(cost, HINTS.cost, 'cost'),
    households: householdsLoaded,
    cycle: loaded(cycle, HINTS.cycle, 'cycle'),
    database: loaded(database, HINTS.database, 'database'),
  };
}
