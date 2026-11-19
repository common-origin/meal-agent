/**
 * Plain-English summaries for /admin: the sentences that say what a table of
 * numbers means. Pure, so they're unit tested without rendering anything.
 */

import { hasManyDeadTuples, plural, weekLabel } from './format';
import type { AiTaskRow, DbStat, SchemaCheck, WeeklyCycle } from './types';

/** The steps after "composed", in order, with how each reads in a sentence. */
const STEPS: { type: string; text: string }[] = [
  { type: 'plan_confirmed', text: 'confirmed it' },
  { type: 'shopping_list_built', text: 'built a shopping list' },
  { type: 'coles_list_sent', text: 'sent it to Coles' },
  { type: 'shopping_completed', text: 'finished shopping' },
];

/** "Week of 16 Nov: of 2 households, 1 composed a plan, 0 confirmed it, …" for the newest week with data. */
export function cycleSentence(cycle: WeeklyCycle): string {
  const latest = [...cycle.weeks].sort((a, b) => (a.week_start < b.week_start ? 1 : -1))[0];
  if (!latest) return 'No weekly plans have been composed yet.';
  const label = weekLabel(latest.week_start);
  if (latest.composed === 0) return `Week of ${label}: no household has composed a plan yet.`;
  const at = (type: string) => cycle.events.funnel.find((f) => f.week_start === latest.week_start && f.type === type)?.households ?? 0;
  const head = `Week of ${label}: of ${plural(cycle.households_total, 'household')}, ${latest.composed} composed a plan`;
  if (!cycle.events.available) return `${head}.`;
  const rest = STEPS.map((step) => `${at(step.type)} ${step.text}`);
  return `${head}, ${rest.slice(0, -1).join(', ')} and ${rest[rest.length - 1]}.`;
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
