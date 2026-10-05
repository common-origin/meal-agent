// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { retryWithExponentialBackoff } from '../utils/async';
import { isRetryableAIError, isTimeoutError } from '../api/aiCall';

function httpError(status: number) {
  return Object.assign(new Error(`[${status}] boom`), { status });
}

const neverResolves = () => new Promise<never>(() => {});

// AbortSignal.timeout runs on Node's own timers, which vi.useFakeTimers()
// doesn't control, so tests build the same signal on the faked setTimeout.
function fakeDeadline(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(new DOMException('The operation timed out.', 'TimeoutError')), ms);
  return controller.signal;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('retryWithExponentialBackoff', () => {
  it('retries a 503 twice with 1 s then 2 s backoff, then gives up', async () => {
    const fn = vi.fn().mockRejectedValue(httpError(503));
    const result = retryWithExponentialBackoff(fn, { isRetryable: isRetryableAIError });
    const assertion = expect(result).rejects.toMatchObject({ status: 503 });

    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(999);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect(fn).toHaveBeenCalledTimes(3);

    await assertion;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('returns the first success after a retry', async () => {
    const fn = vi.fn().mockRejectedValueOnce(httpError(429)).mockResolvedValueOnce('ok');
    const result = retryWithExponentialBackoff(fn, { isRetryable: isRetryableAIError });
    await vi.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 400', async () => {
    const fn = vi.fn().mockRejectedValue(httpError(400));
    await expect(retryWithExponentialBackoff(fn, { isRetryable: isRetryableAIError })).rejects.toMatchObject({
      status: 400,
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries nothing by default', async () => {
    const fn = vi.fn().mockRejectedValue(httpError(503));
    await expect(retryWithExponentialBackoff(fn)).rejects.toMatchObject({ status: 503 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('aborts mid-wait when the deadline fires, without another attempt', async () => {
    const fn = vi.fn().mockRejectedValue(httpError(503));
    const signal = fakeDeadline(500);
    const result = retryWithExponentialBackoff(fn, { signal, isRetryable: isRetryableAIError });
    const assertion = expect(result).rejects.toSatisfy(isTimeoutError);

    await vi.advanceTimersByTimeAsync(500); // deadline fires during the 1 s backoff
    await assertion;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cuts off an in-flight attempt when the deadline fires', async () => {
    const signal = fakeDeadline(1000);
    const result = retryWithExponentialBackoff(neverResolves, { signal, isRetryable: isRetryableAIError });
    const assertion = expect(result).rejects.toSatisfy(isTimeoutError);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it('does not start when the deadline has already passed', async () => {
    const fn = vi.fn();
    const controller = new AbortController();
    controller.abort(new DOMException('late', 'TimeoutError'));
    await expect(retryWithExponentialBackoff(fn, { signal: controller.signal })).rejects.toSatisfy(isTimeoutError);
    expect(fn).not.toHaveBeenCalled();
  });

  it('does not retry an attempt that failed because of the abort', async () => {
    const controller = new AbortController();
    const fn = vi.fn().mockImplementation(() => {
      controller.abort(new DOMException('deadline', 'TimeoutError'));
      return Promise.reject(httpError(503));
    });
    await expect(
      retryWithExponentialBackoff(fn, { signal: controller.signal, isRetryable: isRetryableAIError })
    ).rejects.toSatisfy(isTimeoutError);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('isRetryableAIError', () => {
  it.each([429, 500, 502, 503, 504])('retries HTTP %i', (status) => {
    expect(isRetryableAIError(httpError(status))).toBe(true);
  });

  it.each([400, 401, 403, 404, 422])('does not retry HTTP %i', (status) => {
    expect(isRetryableAIError(httpError(status))).toBe(false);
  });

  it('uses the status, not the message, when there is one', () => {
    expect(isRetryableAIError(Object.assign(new Error('503 overloaded'), { status: 400 }))).toBe(false);
  });

  it.each([
    'Error fetching from https://generativelanguage.googleapis.com: fetch failed',
    'read ECONNRESET',
    'connect ETIMEDOUT 1.2.3.4:443',
  ])('retries the network error "%s"', (message) => {
    expect(isRetryableAIError(new Error(message))).toBe(true);
  });

  it('does not retry by message alone for non-network errors', () => {
    expect(isRetryableAIError(new Error('The model is overloaded (503)'))).toBe(false);
  });

  it('never retries a timeout or abort', () => {
    expect(isRetryableAIError(new DOMException('t', 'TimeoutError'))).toBe(false);
    expect(isRetryableAIError(Object.assign(new Error('fetch failed'), { name: 'AbortError' }))).toBe(false);
  });
});
