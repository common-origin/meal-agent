/**
 * Deadline and retry policy for AI (Gemini) calls made from API routes.
 *
 * One overall deadline per request, shared by every attempt: the signal is
 * passed to the SDK (`generateContent(request, { signal })`) so an in-flight
 * call is actually cut off, and no retry starts once it has fired (#81).
 */

import { GoogleGenerativeAIAbortError } from '@google/generative-ai';
import { retryWithExponentialBackoff } from '@/lib/utils/async';

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const NETWORK_ERROR = /ECONNRESET|ETIMEDOUT|fetch failed/i;

/**
 * Runs `call` with up to 2 retries (1 s then 2 s backoff) on transient
 * errors, all within `deadlineMs`. Throws the deadline's TimeoutError if it
 * passes; check with `isTimeoutError`.
 */
export function callWithDeadline<T>(deadlineMs: number, call: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const signal = AbortSignal.timeout(deadlineMs);
  return retryWithExponentialBackoff(() => call(signal), { signal, isRetryable: isRetryableAIError });
}

/**
 * HTTP 429/5xx from the SDK's `status` field (GoogleGenerativeAIFetchError),
 * or a network failure. Message matching is only the fallback for network
 * errors, which carry no status.
 */
export function isRetryableAIError(error: unknown): boolean {
  if (isTimeoutError(error) || isAbortError(error)) return false;
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status === 'number') return RETRYABLE_STATUSES.has(status);
  const message = error instanceof Error ? error.message : String(error);
  return NETWORK_ERROR.test(message);
}

/** The overall deadline passed (AbortSignal.timeout's reason). */
export function isTimeoutError(error: unknown): boolean {
  return errorName(error) === 'TimeoutError';
}

function isAbortError(error: unknown): boolean {
  return error instanceof GoogleGenerativeAIAbortError || errorName(error) === 'AbortError';
}

// DOMException (the timeout's reason) isn't an Error subclass everywhere.
function errorName(error: unknown): unknown {
  return typeof error === 'object' && error !== null ? (error as { name?: unknown }).name : undefined;
}
