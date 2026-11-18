// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  runHealthChecks: vi.fn(),
  insert: vi.fn(),
  rpc: vi.fn(),
  latest: vi.fn(),
  selects: 0,
}));

vi.mock('@/lib/health/checks', () => ({ runHealthChecks: mocks.runHealthChecks }));
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: mocks.insert,
      select: () => ({
        order: () => ({
          limit: () => ({
            maybeSingle: () => {
              mocks.selects += 1;
              return mocks.latest();
            },
          }),
        }),
      }),
    }),
    rpc: mocks.rpc,
  }),
}));

import { POST } from '../health/record/route';
import { GET } from '../health/route';

const SECRET = 'a-long-random-secret';
const report = {
  ok: false,
  totalLatencyMs: 120,
  checks: {
    database: { ok: true, latencyMs: 5 },
    gemini: { ok: false, latencyMs: 100, detail: 'billing_errors_last_hour', metrics: { billingErrors: 2 } },
  },
};
const post = (authorization?: string) =>
  new NextRequest('http://localhost/api/health/record', { method: 'POST', headers: authorization ? { authorization } : {} });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.selects = 0;
  vi.stubEnv('HEALTH_CHECK_SECRET', SECRET);
  mocks.runHealthChecks.mockResolvedValue(report);
  mocks.insert.mockResolvedValue({ error: null });
  mocks.rpc.mockResolvedValue({ data: 3, error: null });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/health/record (#248)', () => {
  it('answers 404 when HEALTH_CHECK_SECRET is unset, even with a bearer token', async () => {
    vi.stubEnv('HEALTH_CHECK_SECRET', '');
    expect((await POST(post(`Bearer ${SECRET}`))).status).toBe(404);
    expect((await POST(post())).status).toBe(404);
    expect(mocks.runHealthChecks).not.toHaveBeenCalled();
  });

  it.each([
    ['no header', undefined],
    ['the wrong secret', 'Bearer wrong'],
    ['a prefix of the secret', `Bearer ${SECRET.slice(0, 5)}`],
    ['the secret with extra characters', `Bearer ${SECRET}x`],
    ['the wrong scheme', `Basic ${SECRET}`],
    ['the bare secret', SECRET],
  ])('refuses %s with 401: no checks run, nothing written', async (_name, header) => {
    expect((await POST(post(header))).status).toBe(401);
    expect(mocks.runHealthChecks).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('with the right secret runs the checks, writes one row, and purges', async () => {
    const res = await POST(post(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(mocks.runHealthChecks).toHaveBeenCalledTimes(1);
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.insert.mock.calls[0][0]).toMatchObject({ release: 'dev', ok: false, checks: report.checks, total_latency_ms: 120 });
    expect(mocks.rpc).toHaveBeenCalledWith('purge_telemetry');
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, recorded: true });
    expect(body.checks.gemini).toEqual({ ok: false, detail: 'billing_errors_last_hour' });
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });

  it('still answers, and only warns, when the table is missing', async () => {
    mocks.insert.mockResolvedValue({ error: { message: 'relation "public.health_checks" does not exist' } });
    const res = await POST(post(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ recorded: false });
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('migration 021'), expect.any(String));
  });
});

describe('GET /api/health (#248)', () => {
  it("reports the latest stored row's status, time and release, with no per-check detail", async () => {
    mocks.latest.mockResolvedValue({ data: { ok: true, created_at: '2026-11-18T12:07:00Z', release: 'abc1234', checks: { x: 1 } }, error: null });
    const res = await GET();
    expect(await res.json()).toEqual({ status: 'ok', checkedAt: '2026-11-18T12:07:00Z', release: 'abc1234' });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('says failing for a failing row, and never runs live checks (one select)', async () => {
    mocks.latest.mockResolvedValue({ data: { ok: false, created_at: '2026-11-18T12:07:00Z', release: 'abc1234' }, error: null });
    expect((await (await GET()).json()).status).toBe('failing');
    expect(mocks.selects).toBe(1);
    expect(mocks.runHealthChecks).not.toHaveBeenCalled();
  });

  it('says unknown with no row or a missing table, and never throws', async () => {
    mocks.latest.mockResolvedValue({ data: null, error: null });
    expect(await (await GET()).json()).toEqual({ status: 'unknown', checkedAt: null, release: null });
    mocks.latest.mockResolvedValue({ data: null, error: { message: 'no table' } });
    expect((await (await GET()).json()).status).toBe('unknown');
    mocks.latest.mockRejectedValue(new Error('down'));
    expect((await (await GET()).json()).status).toBe('unknown');
  });
});
