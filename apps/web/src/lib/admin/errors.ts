/**
 * Sentry-style triage for the /admin error groups (#279): a severity and a
 * state worked out from what the query already returns (counts over 24 hours
 * and 7 days, first and last seen, source, households affected), plus the
 * links to investigate one. Pure. Nothing here is stored.
 *
 * There is no "Regressed" state: it needs an error to be marked resolved, and
 * nothing in the app records that.
 */

import { isSpike } from './attention';
import type { AdminLink, AdminLinks } from './links';
import type { ErrorGroup, Level } from './types';

const DAY_MS = 86_400_000;

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
 * State: Spike when 24 hours is well over the usual daily rate, New when first
 * seen in the last 24 hours, otherwise Ongoing.
 * Severity: Error for a spike, or a server-side error that hit two or more
 * households; Warning for anything else seen in the last 24 hours (a client
 * error, or one household); Quiet (unknown) when it hasn't happened in 24 hours.
 */
export function classifyError(group: ErrorGroup, now: Date): ErrorTriage {
  const state: ErrorState = isSpike(group) ? 'spike' : now.getTime() - new Date(group.first_seen).getTime() < DAY_MS ? 'new' : 'ongoing';
  const recent = group.count_24h > 0;
  const serious = state === 'spike' || (group.source !== 'client' && group.households >= 2);
  const level: Level = !recent ? 'unknown' : serious ? 'error' : 'warning';
  return { level, levelLabel: level === 'error' ? 'Error' : level === 'warning' ? 'Warning' : 'Quiet', state, stateLabel: STATE_LABEL[state] };
}

const RANK: Record<Level, number> = { error: 0, warning: 1, ok: 2, unknown: 3 };

/** Most severe first, then most recently seen: the order Sentry calls "prioritized". */
export function prioritiseErrors(groups: ErrorGroup[], now: Date): ErrorGroup[] {
  const level = new Map(groups.map((group) => [group, classifyError(group, now).level]));
  return [...groups].sort((a, b) => {
    const byLevel = RANK[level.get(a) ?? 'unknown'] - RANK[level.get(b) ?? 'unknown'];
    return byLevel !== 0 ? byLevel : new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime();
  });
}

/**
 * Where to look next: the Vercel runtime logs (searched for the route, when
 * there is one) and a search of the code for the error's label, route or kind.
 * Messages are scrubbed of ids and emails and the code is the only thing
 * searched, so nothing personal goes in a URL.
 */
export function errorInvestigateLinks(group: ErrorGroup, links: AdminLinks): AdminLink[] {
  const { vercelLogs, githubRepo } = links.targets;
  const term = group.label ?? group.route ?? group.kind;
  return [
    { label: 'Open Vercel runtime logs', href: group.route ? `${vercelLogs}?search=${encodeURIComponent(group.route)}` : vercelLogs },
    { label: 'Search the code on GitHub', href: `${githubRepo}/search?q=${encodeURIComponent(term)}&type=code` },
  ];
}
