// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { APICallError } from 'ai';
import { z } from 'zod';

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

import { runAiTask, AiTaskError, isAiTimeout, isAiInvalidOutput, AI_MAX_RETRIES } from '../run';
import { AI_TASKS } from '../models';

// AbortSignal.timeout runs on Node's own timers, which vi.useFakeTimers()
// doesn't control, so tests build the same signal on the faked setTimeout.
function fakeDeadline(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(new DOMException('The operation timed out.', 'TimeoutError')), ms);
  return controller.signal;
}

const schema = z.object({ answer: z.string() });

function sdkResult(overrides: Record<string, unknown> = {}) {
  return {
    text: '{"answer":"42"}',
    output: { answer: '42' },
    finishReason: 'stop',
    rawFinishReason: 'STOP',
    usage: { inputTokens: 1_200, outputTokens: 1_000, outputTokenDetails: { textTokens: 300, reasoningTokens: 700 } },
    ...overrides,
  };
}

/** What generateText throws when the output can't be parsed or fails the schema. */
function noObjectError(finishReason = 'stop') {
  return Object.assign(new Error('No object generated: response did not match schema.'), {
    name: 'AI_NoObjectGeneratedError',
    finishReason,
    usage: { inputTokens: 900, outputTokens: 50, outputTokenDetails: { textTokens: 50, reasoningTokens: 0 } },
  });
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
    await runAiTask(task as keyof typeof AI_TASKS, { schema, userId: 'user-1', prompt: 'hello' });

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
    await runAiTask('generation', { schema, userId: 'user-1', system: 'You are a chef.', prompt: 'Make dinner.' });
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
    await runAiTask('pantryScan', { schema, userId: 'user-1', messages });
    const call = mocks.generateText.mock.calls[0][0];
    expect(call.messages).toBe(messages);
    expect(call).not.toHaveProperty('prompt');
  });
});

describe('runAiTask results and usage', () => {
  it('returns the text and records one ok usage entry with tokens', async () => {
    mocks.generateText.mockResolvedValue(sdkResult());
    await expect(runAiTask('generation', { schema, userId: 'user-1', prompt: 'x' })).resolves.toEqual({
      output: { answer: '42' },
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

  it('reports a content-filtered response as blocked, with the provider reason and no output', async () => {
    mocks.generateText.mockResolvedValue(
      sdkResult({ text: '', output: undefined, finishReason: 'content-filter', rawFinishReason: 'RECITATION' })
    );
    await expect(runAiTask('recipeFromImage', { schema, userId: 'user-1', prompt: 'x' })).resolves.toEqual({
      blocked: true,
      output: undefined,
      rawFinishReason: 'RECITATION',
    });
    expect(mocks.recordAiUsage.mock.calls[0][1]).toMatchObject({ status: 'blocked', errorCode: 'RECITATION' });
  });

  it('reports a blocked response as blocked even when output parsing throws, keeping the raw reason', async () => {
    mocks.generateText.mockImplementation(async (options: { onStepEnd: (step: unknown) => void }) => {
      options.onStepEnd({ rawFinishReason: 'SAFETY', usage: sdkResult().usage });
      throw noObjectError('content-filter');
    });
    await expect(runAiTask('generation', { schema, userId: 'user-1', prompt: 'x' })).resolves.toEqual({
      blocked: true,
      output: undefined,
      rawFinishReason: 'SAFETY',
    });
    expect(mocks.generateText).toHaveBeenCalledTimes(1);
    expect(mocks.recordAiUsage.mock.calls[0][1]).toMatchObject({ status: 'blocked', errorCode: 'SAFETY' });
  });

  it('derives text output tokens from the total when a provider omits the breakdown', async () => {
    mocks.generateText.mockResolvedValue(
      sdkResult({ usage: { inputTokens: 50, outputTokens: 900, outputTokenDetails: { textTokens: undefined, reasoningTokens: 600 } } })
    );
    await runAiTask('generation', { schema, userId: 'user-1', prompt: 'x' });
    expect(mocks.recordAiUsage.mock.calls[0][1].tokens).toEqual({ inputTokens: 50, outputTokens: 300, thinkingTokens: 600 });
  });

  it('records missing token counts as null', async () => {
    mocks.generateText.mockResolvedValue(
      sdkResult({
        usage: { inputTokens: undefined, outputTokens: undefined, outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined } },
      })
    );
    await runAiTask('recipeFromUrl', { schema, userId: 'user-1', prompt: 'x' });
    expect(mocks.recordAiUsage.mock.calls[0][1].tokens).toEqual({ inputTokens: null, outputTokens: null, thinkingTokens: null });
  });
});

describe('runAiTask structured output (#84)', () => {
  it('sends the schema as structured output', async () => {
    mocks.generateText.mockResolvedValue(sdkResult());
    await runAiTask('generation', { schema, userId: 'user-1', prompt: 'x' });
    const { output } = mocks.generateText.mock.calls[0][0];
    expect(output).toMatchObject({ name: 'object' });
    await expect(output.parseCompleteOutput({ text: '{"answer":"yes"}' }, {})).resolves.toEqual({ answer: 'yes' });
    await expect(output.parseCompleteOutput({ text: '{"answer":1}' }, {})).rejects.toThrow();
  });

  it('retries once when the output fails the schema, and returns the second answer', async () => {
    mocks.generateText.mockRejectedValueOnce(noObjectError()).mockResolvedValueOnce(sdkResult());
    await expect(runAiTask('generation', { schema, userId: 'user-1', prompt: 'x' })).resolves.toMatchObject({
      output: { answer: '42' },
    });
    expect(mocks.generateText).toHaveBeenCalledTimes(2);
    expect(mocks.recordAiUsage.mock.calls.map(([, outcome]) => outcome.status)).toEqual(['invalid_output', 'ok']);
    // The failed attempt is still billed, so its tokens are recorded.
    expect(mocks.recordAiUsage.mock.calls[0][1].tokens).toEqual({ inputTokens: 900, outputTokens: 50, thinkingTokens: 0 });
  });

  it('gives up with invalid_output after the retry also fails', async () => {
    mocks.generateText.mockRejectedValue(noObjectError());
    const error = await runAiTask('generation', { schema, userId: 'user-1', prompt: 'x' }).catch((e: unknown) => e);
    expect(isAiInvalidOutput(error)).toBe(true);
    expect(mocks.generateText).toHaveBeenCalledTimes(2);
  });

  it('does not retry output that was cut off at the token cap', async () => {
    mocks.generateText.mockRejectedValue(noObjectError('length'));
    const error = await runAiTask('generation', { schema, userId: 'user-1', prompt: 'x' }).catch((e: unknown) => e);
    expect(isAiInvalidOutput(error)).toBe(true);
    expect(mocks.generateText).toHaveBeenCalledTimes(1);
  });

  it('treats a missing output (nothing parsed) as invalid', async () => {
    const noOutput = sdkResult();
    Object.defineProperty(noOutput, 'output', {
      get() {
        throw Object.assign(new Error('No output generated.'), { name: 'AI_NoOutputGeneratedError' });
      },
    });
    mocks.generateText.mockResolvedValue(noOutput);
    const error = await runAiTask('recipeFromUrl', { schema, userId: 'user-1', prompt: 'x' }).catch((e: unknown) => e);
    expect(isAiInvalidOutput(error)).toBe(true);
  });
});

describe('runAiTask deadline', () => {
  it('aborts a call that outlives the task deadline and throws a timeout', async () => {
    let signal: AbortSignal | undefined;
    mocks.generateText.mockImplementation((options: { abortSignal: AbortSignal }) => {
      signal = options.abortSignal;
      return new Promise(() => {}); // never answers, even after the abort
    });

    const result = runAiTask('pantryScan', { schema, userId: 'user-1', prompt: 'x' });
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
    const result = runAiTask('recipeFromUrl', { schema, userId: 'user-1', prompt: 'x' });
    const assertion = expect(result).rejects.toMatchObject({ name: 'AiTaskError', code: 'timeout' });
    await vi.advanceTimersByTimeAsync(AI_TASKS.recipeFromUrl.deadlineMs);
    await assertion;
  });

  it('also stops when the caller aborts, without calling it a timeout', async () => {
    const caller = new AbortController();
    mocks.generateText.mockReturnValue(new Promise(() => {}));
    const result = runAiTask('generation', { schema, userId: 'user-1', prompt: 'x', signal: caller.signal });
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
    const error = await runAiTask('generation', { schema, userId: 'user-1', prompt: 'x' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AiTaskError);
    expect(error).toMatchObject({ code, httpStatus, cause: thrown });
    expect(mocks.recordAiUsage.mock.calls[0][1]).toMatchObject({ status, errorCode, tokens: { inputTokens: null } });
  });
});
