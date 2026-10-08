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

import { isOverDailyAiCap, trackedAiCall, startOfUtcDay, DAILY_AI_CALL_CAP } from '../ai/usage';

async function flushAfter() {
  const callbacks = mocks.afterCallbacks.splice(0);
  for (const callback of callbacks) await callback();
}

/** A fake Supabase client covering the calls usage.ts makes. */
function fakeSupabase({
  count = 0,
  countError = null as { message: string } | null,
  householdId = 'household-1' as string | null,
  insertError = null as { message: string } | null,
} = {}) {
  const countQuery = { eq: vi.fn(), gte: vi.fn() };
  countQuery.eq.mockReturnValue(countQuery);
  countQuery.gte.mockResolvedValue({ count, error: countError });
  const insert = vi.fn().mockResolvedValue({ error: insertError });
  const select = vi.fn().mockReturnValue(countQuery);
  const membership = {
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: householdId ? { household_id: householdId } : null }) }) }),
  };
  const client = {
    from: vi.fn((table: string) => (table === 'household_members' ? membership : { select, insert })),
  };
  return { client, insert, select, countQuery };
}

const context = { task: 'scan-pantry-image' as const, model: 'gemini-2.5-flash', userId: 'user-1' };

function geminiResult({
  usage = { promptTokenCount: 1_000, candidatesTokenCount: 200, totalTokenCount: 1_200, thoughtsTokenCount: 800 },
  finishReason = 'STOP',
  blockReason,
}: { usage?: object; finishReason?: string; blockReason?: string } = {}) {
  return {
    response: {
      text: () => '[]',
      usageMetadata: usage,
      candidates: [{ finishReason }],
      ...(blockReason ? { promptFeedback: { blockReason } } : {}),
    },
  } as never;
}

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

describe('trackedAiCall', () => {
  it('returns the result and records one row and one log line with tokens and cost', async () => {
    const supabase = fakeSupabase();
    mocks.createClient.mockResolvedValue(supabase.client);
    const result = geminiResult();

    await expect(trackedAiCall(context, 30_000, async () => result)).resolves.toBe(result);

    expect(console.info).toHaveBeenCalledTimes(1);
    const line = JSON.parse(vi.mocked(console.info).mock.calls[0][0] as string);
    expect(line).toMatchObject({
      type: 'ai_call',
      user_id: 'user-1',
      task: 'scan-pantry-image',
      model: 'gemini-2.5-flash',
      input_tokens: 1_000,
      output_tokens: 200,
      thinking_tokens: 800,
      status: 'ok',
      error_code: null,
    });
    // 1,000 in at $0.30/M + (200 + 800) out at $2.50/M
    expect(line.cost_usd).toBeCloseTo(0.0028, 9);
    expect(line.latency_ms).toEqual(expect.any(Number));

    // The row is written only once the response is done.
    expect(supabase.insert).not.toHaveBeenCalled();
    await flushAfter();
    expect(supabase.insert).toHaveBeenCalledTimes(1);
    expect(supabase.insert).toHaveBeenCalledWith({ ...line, type: undefined, household_id: 'household-1' });
  });

  it('records null tokens and cost when the response has no usage metadata', async () => {
    mocks.createClient.mockResolvedValue(fakeSupabase().client);
    const noUsage = { response: { text: () => '[]', candidates: [{ finishReason: 'STOP' }] } } as never;
    await trackedAiCall(context, 30_000, async () => noUsage);
    const line = JSON.parse(vi.mocked(console.info).mock.calls[0][0] as string);
    expect(line).toMatchObject({ input_tokens: null, output_tokens: null, thinking_tokens: null, cost_usd: null });
  });

  it.each([
    ['a RECITATION finish', { finishReason: 'RECITATION' }, 'RECITATION'],
    ['a SAFETY finish', { finishReason: 'SAFETY' }, 'SAFETY'],
    ['a blocked prompt', { blockReason: 'SAFETY', finishReason: 'STOP' }, 'SAFETY'],
  ])('records %s as blocked', async (_label, options, code) => {
    mocks.createClient.mockResolvedValue(fakeSupabase().client);
    await trackedAiCall(context, 30_000, async () => geminiResult(options));
    const line = JSON.parse(vi.mocked(console.info).mock.calls[0][0] as string);
    expect(line).toMatchObject({ status: 'blocked', error_code: code });
  });

  it.each([
    ['a timeout', new DOMException('deadline', 'TimeoutError'), 'timeout', 'timeout'],
    ['Gemini rate limiting', Object.assign(new Error('[429]'), { status: 429 }), 'rate_limited', 'http_429'],
    ['a 400 from Gemini', Object.assign(new Error('[400]'), { status: 400 }), 'error', 'http_400'],
    ['an unexpected error', new TypeError('boom'), 'error', 'TypeError'],
  ])('records %s and rethrows it', async (_label, error, status, code) => {
    const supabase = fakeSupabase();
    mocks.createClient.mockResolvedValue(supabase.client);
    await expect(trackedAiCall(context, 30_000, async () => Promise.reject(error))).rejects.toBe(error);
    const line = JSON.parse(vi.mocked(console.info).mock.calls[0][0] as string);
    expect(line).toMatchObject({ status, error_code: code, input_tokens: null, cost_usd: null });
    await flushAfter();
    expect(supabase.insert).toHaveBeenCalledTimes(1);
  });

  it('never fails the call when the row cannot be written', async () => {
    const supabase = fakeSupabase({ insertError: { message: 'relation "ai_usage" does not exist' }, householdId: null });
    mocks.createClient.mockResolvedValue(supabase.client);
    await expect(trackedAiCall(context, 30_000, async () => geminiResult())).resolves.toBeDefined();
    await flushAfter();
    expect(supabase.insert).toHaveBeenCalledWith(expect.objectContaining({ household_id: null }));
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('ai_usage'), expect.anything());
  });

  it('swallows a client that cannot be created after the response', async () => {
    mocks.createClient.mockRejectedValue(new Error('no cookies'));
    await trackedAiCall(context, 30_000, async () => geminiResult());
    await expect(flushAfter()).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalled();
  });
});
