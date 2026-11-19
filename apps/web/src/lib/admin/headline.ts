/**
 * The headline at the top of /admin: one sentence saying whether anything
 * needs attention, and four tiles (status, errors, AI spend, households) that
 * link to their sections. Pure; built from what the page already loaded.
 */

import { ago, ERROR_GROUP_LIMIT, formatUsd, RANGE_WORDS, rangeStart } from './format';
import type { DashboardData } from './queries';

export type Tone = 'ok' | 'warning' | 'bad' | 'neutral';

export interface HeadlineTile {
  id: 'status' | 'errors' | 'ai' | 'households';
  label: string;
  value: string;
  note: string;
  tone: Tone;
  /** The section the tile links to. */
  href: string;
}

export interface Headline {
  title: string;
  tiles: HeadlineTile[];
}

const COULDNT = 'Unavailable';

export function computeHeadline(data: DashboardData, now: Date): Headline {
  return { title: titleFor(data), tiles: [statusTile(data, now), errorsTile(data), aiTile(data), householdsTile(data, now)] };
}

function titleFor(data: DashboardData): string {
  if (!data.attention.ok) return "Couldn't work out what needs attention";
  const count = data.attention.data.length;
  if (count === 0) return 'All systems OK';
  return count === 1 ? '1 thing needs attention' : `${count} things need attention`;
}

function statusTile(data: DashboardData, now: Date): HeadlineTile {
  const base = { id: 'status', label: 'Status · latest check', href: '#status' } as const;
  if (!data.status.ok) return { ...base, value: COULDNT, note: 'See the status section', tone: 'neutral' };
  const { latest, heartbeatStale } = data.status.data;
  if (!latest) return { ...base, value: 'No checks yet', note: 'The Uptime workflow has not recorded one', tone: 'neutral' };
  const failing = Object.entries(latest.checks ?? {})
    .filter(([, check]) => !check.ok)
    .map(([name]) => name);
  // Stale first: an old failure says nothing about now, and monitoring having stopped is the thing to fix.
  if (heartbeatStale) {
    const outcome = latest.ok ? 'it passed' : failing.length ? `${failing.join(', ')} failing then` : 'it failed';
    return { ...base, value: 'No recent check', note: `Last check ${ago(latest.created_at, now)} (${outcome})`, tone: 'bad' };
  }
  if (!latest.ok) return { ...base, value: 'Failing', note: failing.length ? `${failing.join(', ')} failing` : 'A check is failing', tone: 'bad' };
  return { ...base, value: 'Healthy', note: `Checked ${ago(latest.created_at, now)}`, tone: 'ok' };
}

function errorsTile(data: DashboardData): HeadlineTile {
  const range = RANGE_WORDS[data.range];
  const base = { id: 'errors', label: `Errors · ${range}${data.household ? ` · household ${data.household}` : ''}`, href: '#errors' } as const;
  if (!data.errors.ok) return { ...base, value: COULDNT, note: 'See the errors section', tone: 'neutral' };
  const total = data.errors.data.reduce((n, group) => n + group.count, 0);
  if (total === 0) return { ...base, value: '0', note: 'None reported', tone: 'ok' };
  const kinds = data.errors.data.length;
  // The query returns at most ERROR_GROUP_LIMIT groups: at the cap, there may be more, so say "at least".
  const capped = kinds >= ERROR_GROUP_LIMIT;
  const note = capped ? `${kinds}+ kinds of error (only the latest ${ERROR_GROUP_LIMIT} are counted)` : kinds === 1 ? '1 kind of error' : `${kinds} kinds of error`;
  return { ...base, value: capped ? `${total}+` : String(total), note, tone: 'warning' };
}

function aiTile(data: DashboardData): HeadlineTile {
  const base = { id: 'ai', label: 'AI spend · today', href: '#cost' } as const;
  if (!data.cost.ok) return { ...base, value: COULDNT, note: 'See cost and quotas', tone: 'neutral' };
  const { spendTodayUsd, capUsd } = data.cost.data;
  const fraction = capUsd > 0 ? spendTodayUsd / capUsd : 0;
  return { ...base, value: formatUsd(spendTodayUsd), note: `of ${formatUsd(capUsd)} daily cap`, tone: fraction >= 1 ? 'bad' : fraction >= 0.8 ? 'warning' : 'ok' };
}

function householdsTile(data: DashboardData, now: Date): HeadlineTile {
  const range = RANGE_WORDS[data.range];
  const base = { id: 'households', label: `Active households · ${range}`, href: '#households' } as const;
  if (!data.households.ok) return { ...base, value: COULDNT, note: 'See households', tone: 'neutral' };
  const since = rangeStart(data.range, now).getTime();
  const households = data.households.data;
  const active = households.filter((h) => h.last_active !== null && new Date(h.last_active).getTime() >= since).length;
  return { ...base, value: `${active} of ${households.length}`, note: `used the app in the last ${range}`, tone: 'neutral' };
}
