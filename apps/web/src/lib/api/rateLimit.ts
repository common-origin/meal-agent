/**
 * In-memory, per-key sliding-window rate limiter for API routes.
 *
 * State lives in the server instance's memory, so it's burst control only:
 * each serverless instance counts separately and a cold start resets it.
 * The durable daily cap on AI usage is tracked in #85.
 */

export type Clock = () => number;

export interface RateLimiterOptions {
  /** Max requests allowed per key within the window. */
  limit: number;
  windowMs: number;
  /** Injectable for tests; defaults to Date.now. */
  now?: Clock;
}

export interface RateLimiter {
  /** Records a request for `key` and returns false if it's over the limit. */
  check(key: string): boolean;
}

export function createRateLimiter({ limit, windowMs, now = Date.now }: RateLimiterOptions): RateLimiter {
  const hits = new Map<string, number[]>();

  return {
    check(key: string): boolean {
      const t = now();
      const recent = (hits.get(key) || []).filter((hit) => t - hit < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(t);
      hits.set(key, recent);
      return true;
    },
  };
}

const TEN_MINUTES_MS = 10 * 60 * 1000;

// One limiter per AI route, shared by every request this instance serves.
export const aiRateLimiters = {
  generateRecipes: createRateLimiter({ limit: 20, windowMs: TEN_MINUTES_MS }),
  scanPantryImage: createRateLimiter({ limit: 10, windowMs: TEN_MINUTES_MS }),
  extractRecipeFromImage: createRateLimiter({ limit: 10, windowMs: TEN_MINUTES_MS }),
  extractRecipeFromUrl: createRateLimiter({ limit: 20, windowMs: TEN_MINUTES_MS }),
};
