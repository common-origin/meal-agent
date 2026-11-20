import { describe, it, expect } from 'vitest';
import { classifyError, errorInvestigateLinks, prioritiseErrors } from '../errors';
import { adminLinks, resolveAction } from '../links';
import type { ErrorGroup } from '../types';

const now = new Date('2026-11-18T12:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
const group = (over: Partial<ErrorGroup> = {}): ErrorGroup => ({
  fingerprint: 'f1',
  label: 'coles-search: lookup failed',
  kind: 'Error',
  message: 'boom',
  route: '/api/coles-search',
  source: 'route',
  count: 10,
  count_24h: 1,
  count_7d: 7,
  first_seen: hoursAgo(24 * 20),
  last_seen: hoursAgo(1),
  releases: ['abc1234'],
  households: 1,
  latest: [],
  ...over,
});

describe('classifyError (#279)', () => {
  it('state: New in the first 24 hours, else Spike over the usual rate, else Ongoing', () => {
    expect(classifyError(group({ count_24h: 10, count_7d: 14 }), now, '7d').state).toBe('spike');
    expect(classifyError(group({ first_seen: hoursAgo(5) }), now, '7d').state).toBe('new');
    expect(classifyError(group(), now, '7d').state).toBe('ongoing');
  });

  it('a new error is New, never also a Spike: its 7 days are its 24 hours, so it has no usual rate', () => {
    const fresh = group({ first_seen: hoursAgo(5), count_24h: 10, count_7d: 10 });
    expect(classifyError(fresh, now, '7d').state).toBe('new');
    expect(classifyError(fresh, now, '30d').state).toBe('new');
  });

  it('on the 24 hour range nothing is a Spike, because the query counts "7 days" within the range (it equals the 24 hour count)', () => {
    // An old error with 6 events in the last 24 hours. On the 24 hour range the query reports count_7d = 6 too (it only looked at 24 hours),
    // which would read as "all of this week's errors were today". On the 7 day range count_7d = 6 is a real 7-day count.
    const old = group({ count_24h: 6, count_7d: 6 });
    expect(classifyError(old, now, '24h')).toMatchObject({ state: 'ongoing', level: 'warning' });
    expect(classifyError(old, now, '7d').state).toBe('spike');
  });

  it('severity: a spike, or a server-side error hitting two or more households, is an Error', () => {
    expect(classifyError(group({ count_24h: 10, count_7d: 14 }), now, '7d')).toMatchObject({ level: 'error', levelLabel: 'Error' });
    expect(classifyError(group({ source: 'route', households: 2 }), now, '7d').level).toBe('error');
    expect(classifyError(group({ source: 'server', households: 3 }), now, '24h').level).toBe('error');
  });

  it('severity: a new error that already happened 5 times is an Error, fewer is a Warning', () => {
    expect(classifyError(group({ first_seen: hoursAgo(3), count_24h: 5, count_7d: 5 }), now, '7d').level).toBe('error');
    expect(classifyError(group({ first_seen: hoursAgo(3), count_24h: 4, count_7d: 4 }), now, '7d').level).toBe('warning');
  });

  it('severity: one household, or a client-side error, is a Warning', () => {
    expect(classifyError(group({ households: 1 }), now, '7d')).toMatchObject({ level: 'warning', levelLabel: 'Warning' });
    expect(classifyError(group({ source: 'client', households: 5 }), now, '7d').level).toBe('warning');
  });

  it('severity: an error not seen in 24 hours is Quiet (unknown), whatever else is true', () => {
    expect(classifyError(group({ count_24h: 0, households: 5 }), now, '7d')).toMatchObject({ level: 'unknown', levelLabel: 'Quiet', state: 'ongoing' });
  });
});

describe('prioritiseErrors', () => {
  it('puts the most severe first, then the most recently seen, and leaves the input alone', () => {
    const quiet = group({ fingerprint: 'quiet', count_24h: 0, last_seen: hoursAgo(30) });
    const warnOld = group({ fingerprint: 'warn-old', last_seen: hoursAgo(5) });
    const warnNew = group({ fingerprint: 'warn-new', last_seen: hoursAgo(1) });
    const bad = group({ fingerprint: 'bad', households: 3, last_seen: hoursAgo(9) });
    const input = [quiet, warnOld, warnNew, bad];
    const rows = prioritiseErrors(input, now, '7d');
    expect(rows.map((row) => row.group.fingerprint)).toEqual(['bad', 'warn-new', 'warn-old', 'quiet']);
    expect(rows.map((row) => row.triage.level)).toEqual(['error', 'warning', 'warning', 'unknown']);
    expect(input.map((g) => g.fingerprint)).toEqual(['quiet', 'warn-old', 'warn-new', 'bad']);
  });
});

describe('errorInvestigateLinks', () => {
  const links = adminLinks({ NEXT_PUBLIC_SUPABASE_URL: 'https://abcd1234.supabase.co' });

  it('links to the runtime logs searched for the route, and to a code search for the quoted label', () => {
    const [logs, code] = errorInvestigateLinks(group(), links);
    expect(logs.href).toBe(`${links.targets.vercelLogs}?search=%2Fapi%2Fcoles-search`);
    expect(code.href).toBe(`${links.targets.githubRepo}/search?q=${encodeURIComponent('"coles-search: lookup failed"')}&type=code`);
  });

  it('with no route, links to the plain logs; with no label, searches the last word of the route, else the kind', () => {
    expect(errorInvestigateLinks(group({ route: null }), links)[0].href).toBe(links.targets.vercelLogs);
    expect(errorInvestigateLinks(group({ label: null }), links)[1].href).toContain('q=coles-search&');
    expect(errorInvestigateLinks(group({ label: null, route: '/api/plan/ics/[token]' }), links)[1].href).toContain('q=ics&');
    expect(errorInvestigateLinks(group({ label: null, route: '/[id]', kind: 'TypeError' }), links)[1].href).toContain('q=TypeError&');
    expect(errorInvestigateLinks(group({ label: null, route: null, kind: 'TypeError' }), links)[1].href).toContain('q=TypeError&');
  });

  it('never puts the message in a URL', () => {
    const [logs, code] = errorInvestigateLinks(group({ message: 'secret-looking text' }), links);
    expect(logs.href + code.href).not.toContain('secret');
  });
});

describe('resolveAction', () => {
  const links = adminLinks({ NEXT_PUBLIC_SUPABASE_URL: 'https://abcd1234.supabase.co' });
  it('points a section action at its anchor, and tools at their external pages', () => {
    expect(resolveAction({ label: 'See errors', target: 'section' }, 'errors', links)).toEqual({ label: 'See errors', href: '#errors', external: false });
    expect(resolveAction({ label: 'Logs', target: 'vercel-logs' }, 'errors', links)).toMatchObject({ href: links.targets.vercelLogs, external: true });
    expect(resolveAction({ label: 'Run', target: 'uptime-workflow' }, 'status', links)?.href).toMatch(/\/actions\/workflows\/uptime\.yml$/);
    expect(resolveAction({ label: 'SQL', target: 'supabase-sql' }, 'database', links)?.href).toBe('https://supabase.com/dashboard/project/abcd1234/sql/new');
  });
  it('returns null for a Supabase action when the URL is not a hosted project', () => {
    const local = adminLinks({ NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321' });
    expect(resolveAction({ label: 'SQL', target: 'supabase-sql' }, 'database', local)).toBeNull();
    expect(resolveAction({ label: 'Perf', target: 'supabase-performance' }, 'database', local)).toBeNull();
  });
});
