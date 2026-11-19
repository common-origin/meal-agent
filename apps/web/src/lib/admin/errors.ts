/**
 * Sentry-style triage for the /admin error groups (#279): a severity and a
 * state worked out from what the query already returns (counts over 24 hours
 * and 7 days, first and last seen, source, households affected), plus the
 * links to investigate one. Pure. Nothing here is stored.
 *
 * There is no "Regressed" state: it needs an error to be marked resolved, and
 * nothing in the app records that.
 */

import { isNewError, isSpike, SPIKE_MIN_24H } from './attention';
import type { AdminLink, AdminLinks } from './links';
import type { ErrorGroup, Level, Range } from './types';

export type ErrorState = 'new' | 'spike' | 'ongoing';

export interface ErrorTriage {
  level: Level;
  /** What the severity label says: "Error", "Warning" or "Quiet". */
  levelLabel: string;
  state: ErrorState;
  stateLabel: string;
}

const STATE_LABEL: Record<ErrorState, string> = { new: 'New', spike: 'Spike', ongoing: 'Ongoing' };

/**
 * State: New when first seen in the last 24 hours, else Spike when 24 hours is
 * well over the usual daily rate, else Ongoing. The rate needs a real 7-day
 * count, which the query only gives on the 7 and 30 day ranges (it counts
 * within the range), so on the 24 hour range nothing is called a Spike.
 * Severity: Error for a spike, a server-side error that hit two or more
 * households, or a new error that already happened SPIKE_MIN_24H times;
 * Warning for anything else seen in the last 24 hours (a client error, or one
 * household); Quiet (unknown) when it hasn't happened in 24 hours.
 */
export function classifyError(group: ErrorGroup, now: Date, range: Range): ErrorTriage {
  const isNew = isNewError(group, now);
  const spike = range !== '24h' && isSpike(group, now);
  const state: ErrorState = isNew ? 'new' : spike ? 'spike' : 'ongoing';
  const recent = group.count_24h > 0;
  const serious = spike || (group.source !== 'client' && group.households >= 2) || (isNew && group.count_24h >= SPIKE_MIN_24H);
  const level: Level = !recent ? 'unknown' : serious ? 'error' : 'warning';
  return { level, levelLabel: level === 'error' ? 'Error' : level === 'warning' ? 'Warning' : 'Quiet', state, stateLabel: STATE_LABEL[state] };
}

const RANK: Record<Level, number> = { error: 0, warning: 1, ok: 2, unknown: 3 };

export interface ErrorRow {
  group: ErrorGroup;
  triage: ErrorTriage;
}

/** Each group with its triage, most severe first, then most recently seen: the order Sentry calls "prioritized". */
export function prioritiseErrors(groups: ErrorGroup[], now: Date, range: Range): ErrorRow[] {
  return groups
    .map((group) => ({ group, triage: classifyError(group, now, range) }))
    .sort((a, b) => RANK[a.triage.level] - RANK[b.triage.level] || new Date(b.group.last_seen).getTime() - new Date(a.group.last_seen).getTime());
}

/** The last path segment of a route that isn't a `[param]`: "/api/plan/ics/[token]" is "ics". Null when there isn't one. */
const routeWord = (route: string | null): string | null => route?.split('/').filter((part) => part && !part.startsWith('[') && !part.startsWith('(')).pop() ?? null;

/**
 * Where to look next: the Vercel runtime logs (searched for the route, when
 * there is one) and a search of the code for the error's label, else the last
 * word of its route, else its kind. Messages are scrubbed of ids and emails
 * and are never put in a URL, so nothing personal goes in one.
 */
export function errorInvestigateLinks(group: ErrorGroup, links: AdminLinks): AdminLink[] {
  const { vercelLogs, githubRepo } = links.targets;
  const term = group.label ? `"${group.label.replace(/"/g, '')}"` : (routeWord(group.route) ?? group.kind);
  return [
    { label: 'Open Vercel runtime logs', href: group.route ? `${vercelLogs}?search=${encodeURIComponent(group.route)}` : vercelLogs },
    { label: 'Search the code on GitHub', href: `${githubRepo}/search?q=${encodeURIComponent(term)}&type=code` },
  ];
}
