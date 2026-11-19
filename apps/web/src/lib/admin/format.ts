/** Small pure helpers for the /admin page. */

import type { HouseholdRow, HouseholdRowRaw, Range } from './types';

export const RANGES: Range[] = ['24h', '7d', '30d'];
export const DEFAULT_RANGE: Range = '7d';
const RANGE_MS: Record<Range, number> = { '24h': 24 * 3_600_000, '7d': 7 * 86_400_000, '30d': 30 * 86_400_000 };

/** `?range=`: one of 24h, 7d, 30d; anything else is the default. */
export function parseRange(value: string | string[] | undefined): Range {
  const first = Array.isArray(value) ? value[0] : value;
  return RANGES.find((range) => range === first) ?? DEFAULT_RANGE;
}

export const rangeStart = (range: Range, now: Date): Date => new Date(now.getTime() - RANGE_MS[range]);

/** `?household=`: the 8-character short ID shown on the page, or null. */
export function parseHouseholdParam(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  return first && /^[0-9a-f]{8}$/.test(first) ? first : null;
}

export const shortId = (id: string): string => id.slice(0, 8);

/** Strips the full ID: only the short ID leaves the server. `viewerHouseholdId` marks the signed-in admin's own household. */
export function toHouseholdRow({ id, ...rest }: HouseholdRowRaw, viewerHouseholdId: string | null = null): HouseholdRow {
  return { shortId: shortId(id), isYou: viewerHouseholdId !== null && id === viewerHouseholdId, ...rest };
}

/** Most recently active first; households that have never been active last. */
export function sortHouseholds(rows: HouseholdRow[]): HouseholdRow[] {
  const time = (row: HouseholdRow) => (row.last_active ? new Date(row.last_active).getTime() : -Infinity);
  return [...rows].sort((a, b) => time(b) - time(a));
}

/** Below this many (estimated) rows a table's dead-tuple ratio is noise: two dead rows in a six-row table is 33%. */
export const DEAD_TUPLE_MIN_ROWS = 1000;
export const DEAD_TUPLE_WARN_RATIO = 0.2;
export const hasManyDeadTuples = (stat: { rows: number; dead_ratio: number }): boolean => stat.rows >= DEAD_TUPLE_MIN_ROWS && stat.dead_ratio > DEAD_TUPLE_WARN_RATIO;

/** The full household ID for a short ID, if one matches (a prefix match on the 8 characters). */
export function resolveHousehold(short: string | null, households: HouseholdRowRaw[]): string | null {
  if (!short) return null;
  return households.find((household) => shortId(household.id) === short)?.id ?? null;
}

/** Under this many households, a share reads "2 of 3", not "67%": a percentage of a handful is noise. */
export const MIN_FOR_PERCENT = 10;

export function shareLabel(count: number, total: number): string {
  if (total <= 0) return '–';
  return total < MIN_FOR_PERCENT ? `${count} of ${total}` : `${Math.round((count / total) * 100)}%`;
}

/** A success rate as a percentage with one decimal, or null with no calls. */
export function successPct(ok: number, calls: number): number | null {
  return calls > 0 ? Math.round((ok / calls) * 1000) / 10 : null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

export const formatUsd = (value: number): string => `$${value.toFixed(value !== 0 && Math.abs(value) < 1 ? 3 : 2)}`;

/** Naive month-end projection: the month-to-date spend, scaled by days elapsed (the current day counts as a fraction). */
export function projectMonthEnd(monthToDateUsd: number, now: Date): { projectedUsd: number; daysElapsed: number; daysInMonth: number } {
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const dayFraction = (now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds()) / 86_400;
  const daysElapsed = now.getUTCDate() - 1 + dayFraction;
  return { projectedUsd: daysElapsed > 0 ? (monthToDateUsd / daysElapsed) * daysInMonth : monthToDateUsd, daysElapsed, daysInMonth };
}

/** "2026-11-16" as "16 Nov". */
export function weekLabel(weekStart: string): string {
  const date = new Date(`${weekStart}T00:00:00Z`);
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** Minutes, hours or days since `iso`, for "last active". */
export function ago(iso: string | null | undefined, now: Date): string {
  if (!iso) return 'never';
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/** 45 minutes, 3 h, 2 h 10 min. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 60_000));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  return total % 60 === 0 ? `${hours} h` : `${hours} h ${total % 60} min`;
}

/** "2026-11-19 09:16 UTC". */
export const utcStamp = (value: string | number | Date): string => new Date(value).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

export const RANGE_WORDS: Record<Range, string> = { '24h': '24 hours', '7d': '7 days', '30d': '30 days' };
