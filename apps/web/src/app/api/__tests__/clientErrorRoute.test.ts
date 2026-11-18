// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  reportErrorAfterResponse: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('@/lib/telemetry/report', () => ({ reportErrorAfterResponse: mocks.reportErrorAfterResponse }));

import { POST } from '../telemetry/client-error/route';
import { clientErrorRateLimiter } from '@/lib/api/rateLimit';

let userCounter = 0;
const post = (body: unknown, raw = false) =>
  new NextRequest('http://localhost/api/telemetry/client-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw ? (body as string) : JSON.stringify(body),
  });
const valid = { kind: 'TypeError', message: 'x is undefined', route: '/plan', topFrame: 'chunks/a.js:1' };

beforeEach(() => {
  vi.clearAllMocks();
  // A fresh user each test, so the burst limiter's memory doesn't carry over.
  mocks.getCurrentUser.mockResolvedValue({ id: `u${++userCounter}`, email: 'a@example.com' });
});

describe('POST /api/telemetry/client-error (#246)', () => {
  it('rejects a signed-out request with 401 and records nothing', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const res = await POST(post(valid));
    expect(res.status).toBe(401);
    expect(mocks.reportErrorAfterResponse).not.toHaveBeenCalled();
  });

  it('records one source=client report with the route, never a household from the body', async () => {
    const res = await POST(post({ ...valid }));
    expect(res.status).toBe(202);
    expect(mocks.reportErrorAfterResponse).toHaveBeenCalledTimes(1);
    const report = mocks.reportErrorAfterResponse.mock.calls[0][0];
    expect(report).toMatchObject({
      source: 'client',
      route: '/plan',
      error: { name: 'TypeError', message: 'x is undefined' },
      context: { topFrame: 'chunks/a.js:1' },
    });
    expect(report).not.toHaveProperty('householdId');
  });

  it.each([
    ['an unknown key (a household id)', { ...valid, household_id: 'h1' }],
    ['a user id', { ...valid, userId: 'u9' }],
    ['a missing field', { kind: 'Error', message: 'x' }],
    ['an over-long message', { ...valid, message: 'x'.repeat(601) }],
    ['a non-string route', { ...valid, route: 5 }],
  ])('rejects %s with 400', async (_name, body) => {
    const res = await POST(post(body));
    expect(res.status).toBe(400);
    expect(mocks.reportErrorAfterResponse).not.toHaveBeenCalled();
  });

  it('rejects an oversized body (about 4 KB) and malformed JSON with 400', async () => {
    const big = await POST(post({ ...valid, topFrame: 'a'.repeat(5000) }));
    expect(big.status).toBe(400);
    const padded = JSON.stringify(valid).replace('}', `,"pad":"${'x'.repeat(5000)}"}`);
    expect((await POST(post(padded, true))).status).toBe(400);
    expect((await POST(post('{not json', true))).status).toBe(400);
    expect((await POST(post('', true))).status).toBe(400);
    expect(mocks.reportErrorAfterResponse).not.toHaveBeenCalled();
  });

  it('is burst limited to 20 a minute per user', async () => {
    const id = 'burst-user';
    mocks.getCurrentUser.mockResolvedValue({ id, email: 'a@example.com' });
    for (let i = 0; i < 20; i++) expect(clientErrorRateLimiter.check(id)).toBe(true);
    expect((await POST(post(valid))).status).toBe(429);
    expect(mocks.reportErrorAfterResponse).not.toHaveBeenCalled();
  });
});
