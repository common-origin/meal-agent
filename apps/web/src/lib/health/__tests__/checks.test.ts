// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  households: vi.fn(),
  aiUsageCount: vi.fn(),
  readColesQuota: vi.fn(),
  aiUsageFilters: [] as unknown[][],
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'households') return { select: () => ({ limit: mocks.households }) };
      const query = {
        eq: (...a: unknown[]) => (mocks.aiUsageFilters.push(['eq', ...a]), query),
        in: (...a: unknown[]) => (mocks.aiUsageFilters.push(['in', ...a]), query),
        gte: (...a: unknown[]) => (mocks.aiUsageFilters.push(['gte', ...a]), mocks.aiUsageCount()),
      };
      return { select: () => query };
    },
  }),
}));
vi.mock('@/lib/coles/quota', () => ({ readColesQuota: mocks.readColesQuota }));

import { checkColes, checkConfig, checkDatabase, checkEmail, checkGemini, runHealthChecks } from '../checks';
import { AI_TASKS } from '@/lib/ai/models';

const goodEnv = {
  GEMINI_API_KEY: 'g-key',
  RAPIDAPI_KEY: 'r-key',
  RESEND_API_KEY: 're',
  RESEND_FROM_ADDRESS: 'a@example.com',
  ADMIN_EMAILS: 'owner@example.com',
  NEXT_PUBLIC_SUPABASE_URL: 'http://x',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
};
const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mocks.aiUsageFilters = [];
  mocks.households.mockResolvedValue({ error: null });
  mocks.aiUsageCount.mockResolvedValue({ count: 0, error: null });
  mocks.readColesQuota.mockResolvedValue({ used: 100, limit: 1000, remaining: 900, month: '2026-11' });
  fetchMock.mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.unstubAllGlobals());

describe('health checks (#248)', () => {
  it('database: ok on a trivial select, failing on an error or a throw (with no raw message stored)', async () => {
    expect((await checkDatabase()).ok).toBe(true);
    mocks.households.mockResolvedValue({ error: { message: 'secret host db.example.com down' } });
    expect(await checkDatabase()).toMatchObject({ ok: false, detail: 'query_failed' });
    mocks.households.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.1 with key abc'));
    const threw = await checkDatabase();
    expect(threw).toMatchObject({ ok: false, detail: 'threw' });
    expect(JSON.stringify(threw)).not.toMatch(/ECONNREFUSED|10\.0\.0\.1|abc/);
  });

  it("gemini: looks the generation model up with the key in a header, and passes when nothing billing-related failed", async () => {
    const result = await checkGemini(goodEnv, new Date('2026-11-18T12:00:00Z'));
    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${AI_TASKS.generation.model}`);
    expect(url).not.toContain('g-key');
    expect(init.headers).toEqual({ 'x-goog-api-key': 'g-key' });
    // Counted ai_usage errors with the real billing code, in the last hour.
    expect(mocks.aiUsageFilters).toContainEqual(['eq', 'status', 'error']);
    expect(mocks.aiUsageFilters).toContainEqual(['in', 'error_code', ['http_402']]);
    expect(mocks.aiUsageFilters).toContainEqual(['gte', 'created_at', '2026-11-18T11:00:00.000Z']);
  });

  it('gemini: fails on a billing refusal in the last hour, which the models endpoint cannot see', async () => {
    mocks.aiUsageCount.mockResolvedValue({ count: 3, error: null });
    expect(await checkGemini(goodEnv)).toMatchObject({ ok: false, detail: 'billing_errors_last_hour', metrics: { billingErrors: 3 } });
  });

  it('gemini: fails on a bad response, with no key, and on a throw', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 });
    expect(await checkGemini(goodEnv)).toMatchObject({ ok: false, detail: 'http_403' });
    expect(await checkGemini({})).toMatchObject({ ok: false, detail: 'missing: GEMINI_API_KEY' });
    fetchMock.mockRejectedValue(new Error('timeout'));
    expect(await checkGemini(goodEnv)).toMatchObject({ ok: false, detail: 'threw' });
  });

  it('gemini: an unreadable billing count does not fail the check', async () => {
    mocks.aiUsageCount.mockResolvedValue({ count: null, error: { message: 'no table' } });
    expect(await checkGemini(goodEnv)).toMatchObject({ ok: true, detail: 'billing_unreadable' });
  });

  it('coles: configured with quota left is ok, and makes no RapidAPI call', async () => {
    expect(await checkColes(goodEnv)).toMatchObject({ ok: true, metrics: { used: 100, limit: 1000, remaining: 900 } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('coles: fails when unconfigured, when the quota is used up, or when it cannot be read', async () => {
    expect(await checkColes({})).toMatchObject({ ok: false, detail: 'missing: RAPIDAPI_KEY' });
    mocks.readColesQuota.mockResolvedValue({ used: 1000, limit: 1000, remaining: 0, month: '2026-11' });
    expect(await checkColes(goodEnv)).toMatchObject({ ok: false, detail: 'quota_used_up', metrics: { remaining: 0 } });
    mocks.readColesQuota.mockResolvedValue(null);
    expect(await checkColes(goodEnv)).toMatchObject({ ok: false, detail: 'quota_unreadable' });
  });

  it('email and config: need their env vars, and name the ones missing', async () => {
    expect((await checkEmail(goodEnv)).ok).toBe(true);
    expect(await checkEmail({ RESEND_API_KEY: 're' })).toMatchObject({ ok: false, detail: 'missing: RESEND_FROM_ADDRESS' });
    expect((await checkConfig(goodEnv)).ok).toBe(true);
    expect(await checkConfig({ ...goodEnv, ADMIN_EMAILS: ' ', SUPABASE_SERVICE_ROLE_KEY: '' })).toMatchObject({
      ok: false,
      detail: 'missing: SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAILS',
    });
  });

  it('runHealthChecks is ok only when every check is, and reports all five', async () => {
    const good = await runHealthChecks(goodEnv);
    expect(good.ok).toBe(true);
    expect(Object.keys(good.checks)).toEqual(['database', 'gemini', 'coles', 'email', 'config']);
    const bad = await runHealthChecks({ ...goodEnv, RESEND_API_KEY: '' });
    expect(bad.ok).toBe(false);
    expect(bad.checks.email.ok).toBe(false);
    expect(bad.checks.database.ok).toBe(true);
  });
});
