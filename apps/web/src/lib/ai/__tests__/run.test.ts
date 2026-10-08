// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { APICallError } from 'ai';

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  recordAiUsage: vi.fn(),
  provider: vi.fn((modelId: string) => ({ modelId })),
}));

vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateText: mocks.generateText,
}));
vi.mock('../client', () => ({ getAiProvider: () => mocks.provider }));
vi.mock('../usage', () => ({ recordAiUsage: mocks.recordAiUsage }));

import { runAiTask, AiTaskError, isAiTimeout, AI_MAX_RETRIES } from '../run';
import { AI_TASKS } from '../models';

// AbortSignal.timeout runs on Node's own timers, which vi.useFakeTimers()
// doesn't control, so tests build the same signal on the faked setTimeout.
function fakeDeadline(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(new DOMException('The operation timed out.', 'TimeoutError')), ms);
  return controller.signal;
}

function sdkResult(overrides: Record<string, unknown> = {}) {
  return {
    text: '{"recipes":[]}',
    finishReason: 'stop',
    rawFinishReason: 'STOP',
    usage: { inputTokens: 1_200, outputTokenDetails: { textTokens: 300, reasoningTokens: 700 } },
    ...overrides,
  };
}

function apiError(statusCode: number) {
  return new APICallError({
    message: `HTTP ${statusCode}`,
    url: 'https://generativelanguage.googleapis.com',
    requestBodyValues: {},
    statusCode,
    isRetryable: statusCode === 429 || statusCode >= 500,
  });
}

/** What the SDK throws once its retries are exhausted. */
function retryError(lastError: unknown) {
  return Object.assign(new Error('Failed after 3 attempts'), { name: 'AI_RetryError', lastError });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(AbortSignal, 'timeout').mockImplementation(fakeDeadline);
  mocks.generateText.mockReset();
  mocks.recordAiUsage.mockReset();
  mocks.provider.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('runAiTask configuration', () => {
  it.each(Object.entries(AI_TASKS))('uses the %s config', async (task, config) => {
    mocks.generateText.mockResolvedValue(sdkResult());
    await runAiTask(task as keyof typeof AI_TASKS, { userId: 'user-1', prompt: 'hello' });

    expect(mocks.provider).toHaveBeenCalledWith(config.model);
    const call = mocks.generateText.mock.calls[0][0];
    expect(call).toMatchObject({
      model: { modelId: config.model },
      prompt: 'hello',
      maxOutputTokens: config.maxOutputTokens,
      maxRetries: AI_MAX_RETRIES,
      providerOptions: { google: { thinkingConfig: { thinkingLevel: config.thinkingLevel } } },
    });
    expect(call.abortSignal).toBeInstanceOf(AbortSignal);
    expect(AbortSignal.timeout).toHaveBeenCalledWith(config.deadlineMs);
    // Sampling is left at the model default (#83).
    expect(call).not.toHaveProperty('temperature');
  });

  it('passes the system prompt separately, not joined onto the user prompt', async () => {
    mocks.generateText.mockResolvedValue(sdkResult());
    await runAiTask('generation', { userId: 'user-1', system: 'You are a chef.', prompt: 'Make dinner.' });
    expect(mocks.generateText.mock.calls[0][0]).toMatchObject({ system: 'You are a chef.', prompt: 'Make dinner.' });
  });

  it('passes multimodal messages through', async () => {
    mocks.generateText.mockResolvedValue(sdkResult());
    const messages = [
      {
        role: 'user' as const,
        content: [
          { type: 'text' as const, text: 'What is in this fridge?' },
          { type: 'file' as const, data: new Uint8Array([1, 2]), mediaType: 'image/png' },
        ],
      },
    ];
    await runAiTask('pantryScan', { userId: 'user-1', messages });
    const call = mocks.generateText.mock.calls[0][0];
    expect(call.messages).toBe(messages);
    expect(call).not.toHaveProperty('prompt');
  });
});

describe('runAiTask results and usage', () => {
  it('returns the text and records one ok usage entry with tokens', async () => {
    mocks.generateText.mockResolvedValue(sdkResult());
    await expect(runAiTask('generation', { userId: 'user-1', prompt: 'x' })).resolves.toEqual({
      text: '{"recipes":[]}',
      blocked: false,
      rawFinishReason: 'STOP',
    });
    expect(mocks.recordAiUsage).toHaveBeenCalledTimes(1);
    expect(mocks.recordAiUsage).toHaveBeenCalledWith(
      { task: 'generation', model: AI_TASKS.generation.model, userId: 'user-1' },
      {
        latencyMs: expect.any(Number),
        status: 'ok',
        errorCode: null,
        tokens: { inputTokens: 1_200, outputTokens: 300, thinkingTokens: 700 },
      }
    );
  });

  it('reports a content-filtered response as blocked, with the provider reason', async () => {
    mocks.generateText.mockResolvedValue(sdkResult({ text: '', finishReason: 'content-filter', rawFinishReason: 'RECITATION' }));
    await expect(runAiTask('recipeFromImage', { userId: 'user-1', prompt: 'x' })).resolves.toMatchObject({
      blocked: true,
      rawFinishReason: 'RECITATION',
    });
    expect(mocks.recordAiUsage.mock.calls[0][1]).toMatchObject({ status: 'blocked', errorCode: 'RECITATION' });
  });

  it('derives text output tokens from the total when a provider omits the breakdown', async () => {
    mocks.generateText.mockResolvedValue(
      sdkResult({ usage: { inputTokens: 50, outputTokens: 900, outputTokenDetails: { textTokens: undefined, reasoningTokens: 600 } } })
    );
    await runAiTask('generation', { userId: 'user-1', prompt: 'x' });
    expect(mocks.recordAiUsage.mock.calls[0][1].tokens).toEqual({ inputTokens: 50, outputTokens: 300, thinkingTokens: 600 });
  });

  it('records missing token counts as null', async () => {
    mocks.generateText.mockResolvedValue(
      sdkResult({
        usage: { inputTokens: undefined, outputTokens: undefined, outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined } },
      })
    );
    await runAiTask('recipeFromUrl', { userId: 'user-1', prompt: 'x' });
    expect(mocks.recordAiUsage.mock.calls[0][1].tokens).toEqual({ inputTokens: null, outputTokens: null, thinkingTokens: null });
  });
});

describe('runAiTask deadline', () => {
  it('aborts a call that outlives the task deadline and throws a timeout', async () => {
    let signal: AbortSignal | undefined;
    mocks.generateText.mockImplementation((options: { abortSignal: AbortSignal }) => {
      signal = options.abortSignal;
      return new Promise(() => {}); // never answers, even after the abort
    });

    const result = runAiTask('pantryScan', { userId: 'user-1', prompt: 'x' });
    const assertion = expect(result).rejects.toSatisfy(isAiTimeout);

    await vi.advanceTimersByTimeAsync(AI_TASKS.pantryScan.deadlineMs - 1);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    expect(signal?.aborted).toBe(true);
    expect(mocks.recordAiUsage.mock.calls[0][1]).toMatchObject({ status: 'timeout', errorCode: 'timeout' });
  });

  it('reports a timeout even when the SDK rejects with its own abort error', async () => {
    mocks.generateText.mockImplementation(
      ({ abortSignal }: { abortSignal: AbortSignal }) =>
        new Promise((_resolve, reject) =>
          abortSignal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
        )
    );
    const result = runAiTask('recipeFromUrl', { userId: 'user-1', prompt: 'x' });
    const assertion = expect(result).rejects.toMatchObject({ name: 'AiTaskError', code: 'timeout' });
    await vi.advanceTimersByTimeAsync(AI_TASKS.recipeFromUrl.deadlineMs);
    await assertion;
  });

  it('also stops when the caller aborts, without calling it a timeout', async () => {
    const caller = new AbortController();
    mocks.generateText.mockReturnValue(new Promise(() => {}));
    const result = runAiTask('generation', { userId: 'user-1', prompt: 'x', signal: caller.signal });
    caller.abort(new DOMException('user left', 'AbortError'));
    const error = await result.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AiTaskError);
    expect(isAiTimeout(error)).toBe(false);
  });
});

describe('runAiTask error mapping', () => {
  it.each([
    ['a 429', apiError(429), 'rate_limited', 429, 'rate_limited', 'http_429'],
    ['a 503 after retries', retryError(apiError(503)), 'unavailable', 503, 'error', 'http_503'],
    ['a 500', apiError(500), 'unavailable', 500, 'error', 'http_500'],
    ['a 400', apiError(400), 'error', 400, 'error', 'http_400'],
    ['a non-HTTP failure', new TypeError('fetch failed'), 'error', undefined, 'error', 'TypeError'],
  ])('maps %s', async (_label, thrown, code, httpStatus, status, errorCode) => {
    mocks.generateText.mockRejectedValue(thrown);
    const error = await runAiTask('generation', { userId: 'user-1', prompt: 'x' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AiTaskError);
    expect(error).toMatchObject({ code, httpStatus, cause: thrown });
    expect(mocks.recordAiUsage.mock.calls[0][1]).toMatchObject({ status, errorCode, tokens: { inputTokens: null } });
  });
});
