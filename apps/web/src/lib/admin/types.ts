/**
 * The shapes the /admin reporting functions (migration 022) return as jsonb,
 * and what the page passes to its components. Everything here is
 * serialisable, and holds no names or emails: a household is shown by its
 * short ID only.
 */

export type Range = '24h' | '7d' | '30d';

export interface AiTaskRow {
  task: string;
  model: string;
  calls: number;
  ok_calls: number;
  p50_ms: number | null;
  p95_ms: number | null;
  avg_input_tokens: number | null;
  avg_output_tokens: number | null;
  cost_usd: number;
  statuses: Record<string, number>;
  top_errors: { code: string; count: number }[];
}

export interface AiFailure {
  created_at: string;
  task: string;
  model: string;
  status: string;
  error_code: string | null;
  latency_ms: number;
}

export interface AiSummary {
  by_task: AiTaskRow[];
  daily: { day: string; calls: number; ok_calls: number; cost_usd: number }[];
  failures: AiFailure[];
  billing_errors: number;
}

export interface ErrorOccurrence {
  created_at: string;
  release: string;
  source: string;
  digest: string | null;
  context: Record<string, unknown>;
}

export interface ErrorGroup {
  fingerprint: string;
  label: string | null;
  kind: string;
  message: string;
  route: string | null;
  source: 'server' | 'route' | 'client';
  count: number;
  count_24h: number;
  count_7d: number;
  first_seen: string;
  last_seen: string;
  releases: string[];
  households: number;
  latest: ErrorOccurrence[];
}

export interface WeekRow {
  week_start: string;
  composed: number;
  recipes_ai: number;
  recipes_imported: number;
  recipes_user_added: number;
}

export interface WeeklyCycle {
  first_week: string;
  last_week: string;
  households_total: number;
  weeks: WeekRow[];
  cuisines: { households: number; avg: number | null; max: number | null };
  events: {
    available: boolean;
    funnel: { week_start: string; type: string; households: number }[];
    swaps: Record<string, number>;
    edits: Record<string, number>;
    ratings: { count: number; avg: number | null; by_star: Record<string, number> };
    counts: Record<string, number>;
  };
}

/** A household as the SQL function returns it. `id` stays on the server: it resolves ?household= and is never rendered. */
export interface HouseholdRowRaw {
  id: string;
  members: number;
  pending_invites: number;
  last_active: string | null;
  has_plan_this_week: boolean;
  settings_complete: boolean;
  ai_calls: number;
  ai_cost_usd: number;
  errors: number;
  last3_generation_failed: boolean;
}

/** A household as the page shows it: the short ID only, and whether it is the signed-in admin's own. */
export interface HouseholdRow extends Omit<HouseholdRowRaw, 'id'> {
  shortId: string;
  isYou: boolean;
}

export interface DbStat {
  table: string;
  rows: number;
  dead_rows: number;
  dead_ratio: number;
  size_bytes: number;
}

export interface SchemaCheck {
  migration: string;
  name: string;
  applied: boolean;
}

export interface HealthCheckRow {
  created_at: string;
  ok: boolean;
  release: string;
  checks: Record<string, { ok: boolean; latencyMs?: number; detail?: string; metrics?: Record<string, number> }>;
  total_latency_ms: number;
}

export interface UptimeView {
  from: number;
  to: number;
  slots: { start: number; state: 'ok' | 'failing' | 'no_data' }[];
  uptimePct: number | null;
  noDataShare: number;
  okSlots: number;
  failingSlots: number;
  noDataSlots: number;
  possibleOutages: { start: number; end: number; slots: number }[];
  outageNow: boolean;
  lastIncident: { start: number; end: number; slots: number } | null;
  /**
   * Set when the first health check is more recent than the start of the range:
   * `from` then begins here, so time before monitoring began is neither "down"
   * nor "no data". Null when the range is fully covered.
   */
  monitoringSince: number | null;
}

export interface StatusData {
  latest: HealthCheckRow | null;
  heartbeatStale: boolean;
  uptime: UptimeView;
  deployedRelease: string;
}

export interface CostData {
  spendTodayUsd: number;
  capUsd: number;
  monthToDateUsd: number;
  projectedMonthUsd: number;
  daysElapsed: number;
  daysInMonth: number;
  coles: { used: number; limit: number; remaining: number; month: string } | null;
}

export type AttentionSection = 'status' | 'errors' | 'ai' | 'cost' | 'households' | 'database';

/**
 * The one severity vocabulary the page uses (#279): how it reads in the UI is
 * the design system's StatusLabel (error is `failed`, warning is `pending`
 * labelled "Warning", ok is `completed`, unknown is `cancelled`).
 */
export type Level = 'error' | 'warning' | 'ok' | 'unknown';

/** Where an action link goes. Resolved against the page's links (resolveAction in ./links) so the rules stay pure and server/client safe. */
export type ActionTarget = 'section' | 'vercel-logs' | 'vercel-project' | 'supabase-sql' | 'supabase-performance' | 'uptime-workflow';

export interface AttentionAction {
  label: string;
  target: ActionTarget;
}

export interface AttentionItem {
  id: string;
  severity: 'error' | 'warning';
  section: AttentionSection;
  /** One sentence of detail, e.g. "The latest health check is failing: gemini". */
  message: string;
  /** A short name for the row, e.g. "Health check failing". */
  title: string;
  /** What it's about: the section and the thing in it, e.g. "Errors · /api/coles-search". */
  where: string;
  /** When it started, as an ISO time, only where the data says so (first seen, or the last good check). Null otherwise. */
  since: string | null;
  /** The period the rule looked at, shown when `since` is null: "last 24 hours", "today (UTC)", "now". */
  window: string;
  /** What to do about it, step by step. */
  fix: string[];
  actions: AttentionAction[];
}

/** One dashboard section's result: its data, or that it couldn't load (and which migration to check). */
export type Loaded<T> = { ok: true; data: T } | { ok: false; hint: string };
