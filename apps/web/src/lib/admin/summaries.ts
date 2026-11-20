/**
 * Plain-English summaries for /admin: the sentences that say what a table of
 * numbers means. Pure, so they're unit tested without rendering anything.
 */

import { hasManyDeadTuples, weekLabel } from './format';
import type { AiTaskRow, DbStat, SchemaCheck, WeeklyCycle } from './types';

/** The weekly routine, in order: the first step is composing a plan, the rest are product events. */
export const FUNNEL_STEPS: { id: string; type: string | null; label: string }[] = [
  { id: 'composed', type: null, label: 'Composed' },
  { id: 'confirmed', type: 'plan_confirmed', label: 'Confirmed' },
  { id: 'list', type: 'shopping_list_built', label: 'List built' },
  { id: 'coles', type: 'coles_list_sent', label: 'Sent to Coles' },
  { id: 'done', type: 'shopping_completed', label: 'Done' },
];

export interface FunnelStep {
  id: string;
  label: string;
  count: number;
}

/** Every step of one week with its household count; the product-event steps are 0 when migration 020 isn't applied. */
export function weekSteps(cycle: WeeklyCycle, weekStart: string, composed: number): FunnelStep[] {
  const at = (type: string) => cycle.events.funnel.find((f) => f.week_start === weekStart && f.type === type)?.households ?? 0;
  return FUNNEL_STEPS.map((step) => ({ id: step.id, label: step.label, count: step.type === null ? composed : at(step.type) }));
}

export interface WeeklyFunnel {
  /** "16 Nov". */
  label: string;
  composed: number;
  households: number;
  /** Composed, then each later step: only Composed when migration 020 isn't applied, rather than a row of zeros. */
  steps: FunnelStep[];
}

/** The newest week's funnel, whatever order the weeks arrive in, or null when no weeks have been composed. */
export function weeklyFunnel(cycle: WeeklyCycle): WeeklyFunnel | null {
  const latest = [...cycle.weeks].sort((a, b) => (a.week_start < b.week_start ? 1 : -1))[0];
  if (!latest) return null;
  const steps = weekSteps(cycle, latest.week_start, latest.composed);
  return { label: weekLabel(latest.week_start), composed: latest.composed, households: cycle.households_total, steps: cycle.events.available ? steps : steps.slice(0, 1) };
}

/** What went wrong for one AI task and model: failed statuses and their top error codes, or "None". */
export function aiProblems(row: Pick<AiTaskRow, 'statuses' | 'top_errors'>): string {
  const failed = Object.entries(row.statuses)
    .filter(([status]) => status !== 'ok')
    .map(([status, n]) => `${status} ${n}`);
  const codes = row.top_errors.map((e) => `${e.code} ×${e.count}`);
  return [...failed, ...codes].join(', ') || 'None';
}

export interface DatabaseSummary {
  /** Migrations not yet run, e.g. ['021']. */
  missing: string[];
  /** "Migrations 009 to 022: all applied" or "Migrations 009 to 022: 021 is missing". */
  migrations: string;
  /** "18 tables, 4.1 MB" is built by the caller (it needs formatBytes); these are the parts. */
  tables: number;
  totalBytes: number;
  /** Tables big enough for the dead-tuple ratio to mean something, and over the threshold. */
  needVacuum: string[];
}

export function databaseSummary(stats: DbStat[], schema: SchemaCheck[]): DatabaseSummary {
  const missing = schema.filter((check) => !check.applied).map((check) => check.migration);
  const range = schema.length > 0 ? `${schema[0].migration} to ${schema[schema.length - 1].migration}` : '';
  const migrations =
    schema.length === 0
      ? 'No migration check available.'
      : missing.length === 0
        ? `Migrations ${range}: all ${schema.length} applied.`
        : `Migrations ${range}: ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} missing.`;
  return {
    missing,
    migrations,
    tables: stats.length,
    totalBytes: stats.reduce((n, s) => n + s.size_bytes, 0),
    needVacuum: stats.filter(hasManyDeadTuples).map((s) => s.table),
  };
}
