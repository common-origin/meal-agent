// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  insert: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  getCurrentUser: mocks.getCurrentUser,
  createClient: async () => ({ rpc: mocks.rpc }),
  createAdminClient: () => ({ from: () => ({ insert: mocks.insert }) }),
}));
const pending: Promise<void>[] = [];
vi.mock('@/lib/adminAlerts', () => ({
  runAfterResponse: (work: () => Promise<void>) => {
    pending.push(work().catch(() => {}));
  },
}));

import { POST } from '../telemetry/events/route';
import { productEventsRateLimiter } from '@/lib/api/rateLimit';

let n = 0;
const post = (body: unknown, raw = false) =>
  new NextRequest('http://localhost/api/telemetry/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw ? (body as string) : JSON.stringify(body),
  });
const ok = { events: [{ type: 'plan_confirmed', props: { weekStart: '2026-11-16' } }, { type: 'export_csv', props: {} }] };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: `u${++n}`, email: 'a@example.com' });
  mocks.rpc.mockResolvedValue({ data: 'house-1' });
  mocks.insert.mockResolvedValue({ error: null });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('POST /api/telemetry/events (#247)', () => {
  it('refuses a signed-out request with 401 and stores nothing', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    expect((await POST(post(ok))).status).toBe(401);
    await Promise.all(pending.splice(0));
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('stores each event with the session household, never a user id or a household from the body', async () => {
    const res = await POST(post({ ...ok }));
    expect(res.status).toBe(202);
    await Promise.all(pending.splice(0));
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    const rows = mocks.insert.mock.calls[0][0];
    expect(rows).toEqual([
      { household_id: 'house-1', type: 'plan_confirmed', props: { weekStart: '2026-11-16' }, release: 'dev' },
      { household_id: 'house-1', type: 'export_csv', props: {}, release: 'dev' },
    ]);
    expect(JSON.stringify(rows)).not.toContain('user_id');
  });

  it.each([
    ['an unknown prop (a recipe id)', { events: [{ type: 'favorite_added', props: { recipeId: 'ai-lemon-chicken' } }] }],
    ['a free-text string', { events: [{ type: 'swap', props: { kind: 'Butter Chicken' } }] }],
    ['an unknown event type', { events: [{ type: 'page_view', props: {} }] }],
    ['a household in the body', { household_id: 'h9', events: ok.events }],
    ['a user id on an event', { events: [{ type: 'export_csv', props: {}, userId: 'u1' }] }],
    ['more than 20 events', { events: Array(21).fill({ type: 'export_csv', props: {} }) }],
    ['no events', { events: [] }],
  ])('rejects %s with 400 and stores nothing', async (_name, body) => {
    expect((await POST(post(body))).status).toBe(400);
    await Promise.all(pending.splice(0));
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('rejects an oversized body (about 8 KB) and malformed JSON', async () => {
    const padded = JSON.stringify(ok).replace('}]}', `}],"pad":"${'x'.repeat(9000)}"}`);
    expect((await POST(post(padded, true))).status).toBe(400);
    expect((await POST(post('{nope', true))).status).toBe(400);
    expect((await POST(post('', true))).status).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('is burst limited per user', async () => {
    const id = 'burst';
    mocks.getCurrentUser.mockResolvedValue({ id, email: 'a@example.com' });
    for (let i = 0; i < 30; i++) productEventsRateLimiter.check(id);
    expect((await POST(post(ok))).status).toBe(429);
  });

  it('succeeds, and only warns, when the table is missing', async () => {
    mocks.insert.mockResolvedValue({ error: { message: 'relation "public.product_events" does not exist' } });
    expect((await POST(post(ok))).status).toBe(202);
    await Promise.all(pending.splice(0));
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('migration 020'), expect.any(String));
  });

  it('stores nothing when the user has no household', async () => {
    mocks.rpc.mockResolvedValue({ data: null });
    expect((await POST(post(ok))).status).toBe(202);
    await Promise.all(pending.splice(0));
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
