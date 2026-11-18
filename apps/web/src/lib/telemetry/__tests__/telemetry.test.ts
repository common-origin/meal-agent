// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { release } from '../release';
import { routePattern } from '../routePattern';
import { scrub, MAX_MESSAGE_LENGTH } from '../scrub';
import { fingerprint, normaliseMessage } from '../fingerprint';
import { buildErrorRow, sanitizeContext, topFrameOf } from '../errorRow';

const UUID = '3f2b8c1e-9a47-4d6e-b0a1-5c7d2e8f9a10';

describe('release', () => {
  it('is the short commit SHA, or dev locally', () => {
    expect(release({ VERCEL_GIT_COMMIT_SHA: '5ca5b81d9f0e1a2b3c4d' })).toBe('5ca5b81');
    expect(release({})).toBe('dev');
    expect(release({ VERCEL_GIT_COMMIT_SHA: '  ' })).toBe('dev');
  });
});

describe('routePattern', () => {
  it.each([
    ['/plan', '/plan'],
    ['/', '/'],
    ['', '/'],
    ['/plan?week=2026-11-16&token=abc', '/plan'],
    ['/shopping-list#top', '/shopping-list'],
    ['/recipe/ai-quick-italian-chicken-veggie-skillet', '/recipe/[param]'],
    ['/recipe/pad', '/recipe/[param]'],
    ['/recipes/add', '/recipes/add'],
    [`/join/${UUID}`, '/join/[param]'],
    [`/api/plan/ics/${UUID}`, '/api/plan/ics/[param]'],
    ['/api/plan/ics/abc', '/api/plan/ics/[param]'],
    ['/api/coles/purchases/confirm', '/api/coles/purchases/confirm'],
    ['/settings/data-export', '/settings/data-export'],
    ['/app/api/plan/ics/[token]', '/app/api/plan/ics/[token]'],
    ['/app/recipe/[id]', '/app/recipe/[id]'],
    ['/something/12345', '/something/[param]'],
  ])('%s → %s', (input, expected) => {
    expect(routePattern(input)).toBe(expected);
  });

  it('never leaks a recipe ID, ICS token or invite token', () => {
    for (const path of [`/recipe/jamie-oliver-lemon-chicken?x=1`, `/api/plan/ics/${UUID}`, `/join/${UUID}?ref=a@b.co`]) {
      const out = routePattern(path);
      expect(out).not.toContain(UUID);
      expect(out).not.toContain('lemon');
      expect(out).not.toContain('?');
      expect(out).not.toContain('@');
    }
  });
});

describe('scrub', () => {
  it('removes emails', () => {
    expect(scrub('Could not send to jane.doe+x@example.com.au today')).toBe('Could not send to [email] today');
  });

  it('removes URLs, including query strings', () => {
    const out = scrub('fetch failed for https://www.example.com/recipes/lemon-chicken?token=abc123&x=1 (timeout)');
    expect(out).toBe('fetch failed for [url] (timeout)');
  });

  it('removes ICS and invite tokens (uuids)', () => {
    const out = scrub(`no household for ics_token ${UUID.toUpperCase()}; invite ${UUID}`);
    expect(out).not.toContain(UUID);
    expect(out.toLowerCase()).not.toContain(UUID);
    expect(out).toContain('[id]');
  });

  it('removes recipe IDs, bare, quoted and in a Postgres key detail', () => {
    expect(scrub('recipe ai-quick-italian-chicken-veggie-skillet not found')).toBe('recipe [slug] not found');
    expect(scrub('Key (id)=(pad-thai) already exists')).toBe('Key (id)=([value]) already exists');
    expect(scrub('Key (recipe_id)=(jamie-oliver-lemon-chicken) violates foreign key')).not.toContain('lemon');
    expect(scrub(`missing "Chicken Stir Fry" and 'Lamb Rogan Josh'`)).toBe('missing [str] and [str]');
  });

  it('keeps ISO dates', () => {
    expect(scrub('no plan for week 2026-11-16')).toBe('no plan for week 2026-11-16');
  });

  it('keeps apostrophes inside words', () => {
    expect(scrub("can't read the household's plan")).toBe("can't read the household's plan");
  });

  it('removes long digit runs and opaque tokens', () => {
    expect(scrub('order 123456789 failed')).toBe('order [n] failed');
    expect(scrub('bad token aB3dEf6hIj9lMn2pQr5tUv8x')).toBe('bad token [token]');
    expect(scrub('retry after 3000ms, status 503')).toBe('retry after 3000ms, status 503');
  });

  it('collapses whitespace, truncates to 300 characters and tolerates null', () => {
    expect(scrub('a\n  b\t c')).toBe('a b c');
    expect(scrub('x'.repeat(1000))).toHaveLength(MAX_MESSAGE_LENGTH);
    expect(scrub(null)).toBe('');
    expect(scrub(undefined)).toBe('');
  });
});

describe('fingerprint', () => {
  const base = { source: 'route', kind: 'TypeError', route: '/api/x', message: 'timed out after 31ms' };

  it('is stable and groups messages that differ only in digits or case', () => {
    expect(fingerprint(base)).toBe(fingerprint({ ...base, message: 'Timed out after 8ms' }));
    expect(fingerprint(base)).toMatch(/^[0-9a-f]{40}$/);
    expect(normaliseMessage('Timed out after 31ms')).toBe('timed out after 0ms');
  });

  it('differs by source, kind, route and message', () => {
    const f = fingerprint(base);
    expect(fingerprint({ ...base, source: 'server' })).not.toBe(f);
    expect(fingerprint({ ...base, kind: 'Error' })).not.toBe(f);
    expect(fingerprint({ ...base, route: '/api/y' })).not.toBe(f);
    expect(fingerprint({ ...base, message: 'something else' })).not.toBe(f);
  });

  it('uses the label instead of the message when there is one', () => {
    const labelled = { ...base, label: 'coles-search: lookup failed' };
    expect(fingerprint(labelled)).toBe(fingerprint({ ...labelled, message: 'a different message', kind: 'Error' }));
    expect(fingerprint(labelled)).not.toBe(fingerprint(base));
  });
});

describe('buildErrorRow', () => {
  it('stores a pattern, a scrubbed message and only whitelisted context', () => {
    const error = Object.assign(new Error(`no row for jane@example.com at https://x.test/a?b=1`), { digest: '1234567' });
    const row = buildErrorRow(
      {
        source: 'server',
        route: '/app/api/plan/ics/[token]',
        error,
        context: { method: 'get', routeType: 'route', renderSource: 'bogus', status: 500 },
      },
      { VERCEL_GIT_COMMIT_SHA: 'abcdef123456' }
    );
    expect(row).toMatchObject({
      release: 'abcdef1',
      source: 'server',
      route: '/app/api/plan/ics/[token]',
      label: null,
      kind: 'Error',
      message: 'no row for [email] at [url]',
      digest: '1234567',
      household_id: null,
    });
    expect(row.context).toMatchObject({ method: 'GET', routeType: 'route', status: 500 });
    expect(row.context).not.toHaveProperty('renderSource');
    expect(Object.keys(row.context).every((k) => ['method', 'routeType', 'renderSource', 'status', 'topFrame'].includes(k))).toBe(true);
    expect(JSON.stringify(row)).not.toContain('jane');
    expect(row).not.toHaveProperty('user_id');
  });

  it('normalises an actual path into a pattern', () => {
    const row = buildErrorRow({ source: 'route', route: `/api/plan/ics/${UUID}?x=1`, label: 'ics: failed', error: new Error('boom') });
    expect(row.route).toBe('/api/plan/ics/[param]');
    expect(row.label).toBe('ics: failed');
  });

  it('keeps a developer-written label as written, even with hyphenated route names', () => {
    expect(buildErrorRow({ source: 'route', label: 'scan-pantry-image: request failed', error: new Error('x') }).label).toBe('scan-pantry-image: request failed');
  });

  it('handles non-Error values and odd names', () => {
    expect(buildErrorRow({ source: 'route', error: 'plain string' }).message).toBe('plain string');
    expect(buildErrorRow({ source: 'route', error: { message: 'pg said no', code: '42P01' } }).message).toBe('pg said no');
    expect(buildErrorRow({ source: 'route', error: undefined }).message).toBe('');
    const odd = new Error('x');
    odd.name = 'weird name with spaces and a@b.co';
    expect(buildErrorRow({ source: 'route', error: odd }).kind).toBe('Error');
  });

  it('stores the top frame only, as file:line', () => {
    const stack = `Error: boom\n    at handler (/var/task/apps/web/.next/server/chunks/abc.js:12:34)\n    at other (/x/y.js:1:1)`;
    expect(topFrameOf(stack)).toBe('chunks/abc.js:12');
    expect(topFrameOf('boom@https://app.example.com/_next/static/chunks/main.js?v=3:7:9')).toBe('chunks/main.js:7');
    expect(topFrameOf(undefined)).toBeUndefined();
  });

  it('drops context keys outside the whitelist', () => {
    const dirty = { method: 'POST', status: 700, topFrame: 'a.js:1', email: 'a@b.co', url: '/x?y' } as Parameters<typeof sanitizeContext>[0];
    expect(sanitizeContext(dirty)).toEqual({ method: 'POST', topFrame: 'a.js:1' });
  });
});
