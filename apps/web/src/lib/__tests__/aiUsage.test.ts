// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  sendEmail: vi.fn<(message: { to: string[]; subject: string }) => Promise<{ error: null }>>(async () => ({ error: null })),
  afterCallbacks: [] as Array<() => unknown>,
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient, createAdminClient: mocks.createAdminClient }));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mocks.sendEmail };
  },
}));

// Collect after() work so tests can run it explicitly, as Next would once the
// response has been sent.
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (callback: () => unknown) => {
    mocks.afterCallbacks.push(callback);
  },
}));

import {
  checkAiAllowance,
  dailySpendCapUsd,
  recordAiUsage,
  resetSpendAlertForTests,
  startOfUtcDay,
  DAILY_AI_CALL_CAP,
  DEFAULT_DAILY_SPEND_CAP_USD,
} from '../ai/usage';

async function flushAfter() {
  const callbacks = mocks.afterCallbacks.splice(0);
  for (const callback of callbacks) await callback();
}

/** A fake Supabase client covering the calls usage.ts makes. */
function fakeSupabase({
  count = 0,
  countError = null as { message: string } | null,
  insertError = null as { message: string } | null,
} = {}) {
  const countQuery = { eq: vi.fn(), gte: vi.fn() };
  countQuery.eq.mockReturnValue(countQuery);
  countQuery.gte.mockResolvedValue({ count, error: countError });
  const insert = vi.fn().mockResolvedValue({ error: insertError });
  const select = vi.fn().mockReturnValue(countQuery);
  const client = { from: vi.fn(() => ({ select, insert })) };
  return { client, insert, select, countQuery };
}

/** The service-role client checkAiAllowance reads. */
function fakeAdmin({
  count = 0,
  spend = 0,
  countError = null as { message: string } | null,
  spendError = null as { message: string } | null,
} = {}) {
  const countQuery = { eq: vi.fn(), gte: vi.fn() };
  countQuery.eq.mockReturnValue(countQuery);
  countQuery.gte.mockResolvedValue({ count, error: countError });
  const select = vi.fn().mockReturnValue(countQuery);
  const client = {
    from: vi.fn(() => ({ select })),
    rpc: vi.fn().mockResolvedValue({ data: spendError ? null : spend, error: spendError }),
  };
  return { client, select, countQuery };
}

const context = { task: 'pantryScan' as const, model: 'gemini-3.5-flash-lite', userId: 'user-1' };

const okOutcome = {
  latencyMs: 850,
  status: 'ok' as const,
  errorCode: null,
  tokens: { inputTokens: 1_000, outputTokens: 200, thinkingTokens: 800 },
};

beforeEach(() => {
  vi.restoreAllMocks();
  mocks.createClient.mockReset();
  mocks.createAdminClient.mockReset();
  mocks.sendEmail.mockClear();
  mocks.afterCallbacks.length = 0;
  resetSpendAlertForTests();
  vi.unstubAllEnvs();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('checkAiAllowance (#215)', () => {
  it('allows a user under both limits', async () => {
    mocks.createAdminClient.mockReturnValue(fakeAdmin({ count: DAILY_AI_CALL_CAP - 1, spend: 4.99 }).client);
    await expect(checkAiAllowance('user-1')).resolves.toBe('ok');
  });

  it("stops a user at their daily cap", async () => {
    mocks.createAdminClient.mockReturnValue(fakeAdmin({ count: DAILY_AI_CALL_CAP }).client);
    await expect(checkAiAllowance('user-1')).resolves.toBe('daily_cap');
  });

  it("pauses everyone once the day's spend reaches the ceiling, ahead of the per-user cap", async () => {
    mocks.createAdminClient.mockReturnValue(fakeAdmin({ count: DAILY_AI_CALL_CAP, spend: DEFAULT_DAILY_SPEND_CAP_USD }).client);
    await expect(checkAiAllowance('user-1')).resolves.toBe('spend_cap');
  });

  it("counts the user's calls and everyone's spend since UTC midnight, with the service role", async () => {
    const admin = fakeAdmin();
    mocks.createAdminClient.mockReturnValue(admin.client);
    await checkAiAllowance('user-1', new Date('2026-10-08T23:30:00+10:00')); // 13:30 UTC on 8 Oct
    expect(admin.client.from).toHaveBeenCalledWith('ai_usage');
    expect(admin.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    expect(admin.countQuery.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(admin.countQuery.gte).toHaveBeenCalledWith('created_at', '2026-10-08T00:00:00.000Z');
    expect(admin.client.rpc).toHaveBeenCalledWith('ai_spend_since', { since: '2026-10-08T00:00:00.000Z' });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it.each([
    ['the count query errors', { countError: { message: 'relation "ai_usage" does not exist' } }],
    ['the spend function is missing (migration 014 not run)', { spendError: { message: 'Could not find the function' } }],
  ])('fails closed when %s', async (_, failure) => {
    mocks.createAdminClient.mockReturnValue(fakeAdmin(failure).client);
    await expect(checkAiAllowance('user-1')).resolves.toBe('unavailable');
    expect(console.error).toHaveBeenCalled();
  });

  it('fails closed when the service-role client cannot be created', async () => {
    mocks.createAdminClient.mockImplementation(() => {
      throw new Error('Missing Supabase service role key');
    });
    await expect(checkAiAllowance('user-1')).resolves.toBe('unavailable');
  });
});

describe('dailySpendCapUsd', () => {
  it('takes AI_DAILY_SPEND_CAP_USD when it is a positive number, else the default', () => {
    expect(dailySpendCapUsd({ AI_DAILY_SPEND_CAP_USD: '12.5' })).toBe(12.5);
    expect(dailySpendCapUsd({})).toBe(DEFAULT_DAILY_SPEND_CAP_USD);
    expect(dailySpendCapUsd({ AI_DAILY_SPEND_CAP_USD: '0' })).toBe(DEFAULT_DAILY_SPEND_CAP_USD);
    expect(dailySpendCapUsd({ AI_DAILY_SPEND_CAP_USD: 'lots' })).toBe(DEFAULT_DAILY_SPEND_CAP_USD);
  });
});

describe('spend ceiling alert (#215)', () => {
  beforeEach(() => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('RESEND_FROM_ADDRESS', 'Meal Agent <alerts@example.com>');
    vi.stubEnv('ADMIN_EMAILS', 'owner@example.com');
    mocks.createAdminClient.mockReturnValue(fakeAdmin({ spend: 9 }).client);
  });

  it('emails the admins once per UTC day, after the response', async () => {
    const day = new Date('2026-10-08T05:00:00Z');
    await checkAiAllowance('user-1', day);
    await checkAiAllowance('user-2', day);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    await flushAfter();
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendEmail.mock.calls[0][0]).toMatchObject({ to: ['owner@example.com'], subject: expect.stringContaining('AI paused') });

    await checkAiAllowance('user-1', new Date('2026-10-09T05:00:00Z'));
    await flushAfter();
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
  });

  it('tries again on the next refusal when the email fails', async () => {
    const day = new Date('2026-10-11T05:00:00Z');
    mocks.sendEmail.mockResolvedValueOnce({ error: { message: 'Resend is down' } } as never);
    await checkAiAllowance('user-1', day);
    await flushAfter();
    await checkAiAllowance('user-1', day);
    await flushAfter();
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
  });

  it('only logs when email is not configured', async () => {
    vi.stubEnv('ADMIN_EMAILS', '');
    await checkAiAllowance('user-1', new Date('2026-10-10T05:00:00Z'));
    await flushAfter();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('ai_spend_cap'));
  });
});

describe('startOfUtcDay', () => {
  it('uses the UTC date, not the local one', () => {
    expect(startOfUtcDay(new Date('2026-10-09T06:00:00+10:00'))).toBe('2026-10-08T00:00:00.000Z');
  });
});

describe('recordAiUsage', () => {
  it('writes with the service role and an explicit household when the caller has no session (#215)', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => ({ insert })) });
    recordAiUsage({ ...context, householdId: 'household-9' }, okOutcome);
    await flushAfter();
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'user-1', household_id: 'household-9' }));
  });

  it('logs one ai_call line now and writes the row only after the response', async () => {
    const supabase = fakeSupabase();
    mocks.createClient.mockResolvedValue(supabase.client);

    recordAiUsage(context, okOutcome);

    expect(console.info).toHaveBeenCalledTimes(1);
    const line = JSON.parse(vi.mocked(console.info).mock.calls[0][0] as string);
    expect(line).toMatchObject({
      type: 'ai_call',
      user_id: 'user-1',
      task: 'pantryScan',
      model: 'gemini-3.5-flash-lite',
      input_tokens: 1_000,
      output_tokens: 200,
      thinking_tokens: 800,
      latency_ms: 850,
      status: 'ok',
      error_code: null,
    });
    // 1,000 in at $0.30/M + (200 + 800) out at $2.50/M
    expect(line.cost_usd).toBeCloseTo(0.0028, 9);

    expect(supabase.insert).not.toHaveBeenCalled();
    await flushAfter();
    // household_id is left to the column default (get_user_household_id()).
    const row = Object.fromEntries(Object.entries(line).filter(([key]) => key !== 'type'));
    expect(supabase.insert).toHaveBeenCalledWith(row);
    expect(supabase.client.from).toHaveBeenCalledWith('ai_usage');
  });

  it('records a null cost when token counts are missing', () => {
    mocks.createClient.mockResolvedValue(fakeSupabase().client);
    recordAiUsage(context, {
      ...okOutcome,
      status: 'timeout',
      errorCode: 'timeout',
      tokens: { inputTokens: null, outputTokens: null, thinkingTokens: null },
    });
    const line = JSON.parse(vi.mocked(console.info).mock.calls[0][0] as string);
    expect(line).toMatchObject({ status: 'timeout', error_code: 'timeout', input_tokens: null, cost_usd: null });
  });

  it('never throws when the row cannot be written', async () => {
    const supabase = fakeSupabase({ insertError: { message: 'relation "ai_usage" does not exist' } });
    mocks.createClient.mockResolvedValue(supabase.client);
    expect(() => recordAiUsage(context, okOutcome)).not.toThrow();
    await flushAfter();
    expect(supabase.insert).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('ai_usage'), expect.anything());
  });

  it('swallows a client that cannot be created after the response', async () => {
    mocks.createClient.mockRejectedValue(new Error('no cookies'));
    recordAiUsage(context, okOutcome);
    await expect(flushAfter()).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalled();
  });
});
