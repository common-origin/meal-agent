/**
 * Shared utility functions for API requests
 */

import { API_MAX_RETRIES, API_INITIAL_RETRY_DELAY_MS } from '../constants';

export interface RetryOptions {
  /** Retries after the first attempt. */
  maxRetries?: number;
  /** Delay before the first retry; doubles for each one after. */
  initialDelayMs?: number;
  /**
   * Overall deadline shared by every attempt and wait. Once it fires, the
   * in-flight attempt and any backoff are abandoned with `signal.reason`,
   * and no further attempt starts.
   */
  signal?: AbortSignal;
  /** Which errors are worth retrying. Defaults to none. */
  isRetryable?: (error: unknown) => boolean;
}

/**
 * Retry a function with exponential backoff
 * Useful for handling transient API errors
 */
export async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  {
    maxRetries = API_MAX_RETRIES,
    initialDelayMs = API_INITIAL_RETRY_DELAY_MS,
    signal,
    isRetryable = () => false,
  }: RetryOptions = {}
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted();
    try {
      return await raceAbort(fn(), signal);
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      if (attempt >= maxRetries || !isRetryable(error)) throw error;

      const delay = initialDelayMs * Math.pow(2, attempt);
      console.log(`⏳ Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await sleep(delay, signal);
    }
  }
}

/** Resolves after `ms`, or rejects with `signal.reason` if it fires first. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Settles with `promise`, or rejects with `signal.reason` as soon as the
 * signal fires. `promise` stays observed either way, so its late rejection
 * isn't left unhandled.
 */
export function raceAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Debounce a function call
 * Useful for text inputs to avoid excessive re-renders
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  
  return function(this: unknown, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delayMs);
  };
}
