// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  afterCallbacks: [] as Array<() => unknown>,
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));

// Collect after() work so tests can run it explicitly, as Next would once the
// response has been sent.
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (callback: () => unknown) => {
    mocks.afterCallbacks.push(callback);
  },
}));

import { isOverDailyAiCap, recordAiUsage, startOfUtcDay, DAILY_AI_CALL_CAP } from '../ai/usage';

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
  mocks.afterCallbacks.length = 0;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('isOverDailyAiCap', () => {
  it('allows a user under the cap', async () => {
    const supabase = fakeSupabase({ count: DAILY_AI_CALL_CAP - 1 });
    mocks.createClient.mockResolvedValue(supabase.client);
    await expect(isOverDailyAiCap('user-1')).resolves.toBe(false);
  });

  it('blocks a user who has reached the cap', async () => {
    const supabase = fakeSupabase({ count: DAILY_AI_CALL_CAP });
    mocks.createClient.mockResolvedValue(supabase.client);
    await expect(isOverDailyAiCap('user-1')).resolves.toBe(true);
  });

  it("counts only the user's rows since UTC midnight", async () => {
    const supabase = fakeSupabase();
    mocks.createClient.mockResolvedValue(supabase.client);
    await isOverDailyAiCap('user-1', new Date('2026-10-08T23:30:00+10:00')); // 13:30 UTC on 8 Oct
    expect(supabase.client.from).toHaveBeenCalledWith('ai_usage');
    expect(supabase.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    expect(supabase.countQuery.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(supabase.countQuery.gte).toHaveBeenCalledWith('created_at', '2026-10-08T00:00:00.000Z');
  });

  it('fails open when the query errors (e.g. the migration has not run)', async () => {
    const supabase = fakeSupabase({ count: 999, countError: { message: 'relation "ai_usage" does not exist' } });
    mocks.createClient.mockResolvedValue(supabase.client);
    await expect(isOverDailyAiCap('user-1')).resolves.toBe(false);
    expect(console.warn).toHaveBeenCalled();
  });

  it('fails open when the client cannot be created', async () => {
    mocks.createClient.mockRejectedValue(new Error('no cookies'));
    await expect(isOverDailyAiCap('user-1')).resolves.toBe(false);
  });
});

describe('startOfUtcDay', () => {
  it('uses the UTC date, not the local one', () => {
    expect(startOfUtcDay(new Date('2026-10-09T06:00:00+10:00'))).toBe('2026-10-08T00:00:00.000Z');
  });
});

describe('recordAiUsage', () => {
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
