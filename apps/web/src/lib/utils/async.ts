/**
 * Shared utility functions for API requests
 */

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
