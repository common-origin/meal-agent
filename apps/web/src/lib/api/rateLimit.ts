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
  let lastSweep = now();

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
      evictExpired(t);
      return true;
    },
  };

  // Drops keys whose newest hit has left the window, at most once per window,
  // so the map doesn't keep one entry per user for the life of the instance.
  function evictExpired(t: number) {
    if (t - lastSweep < windowMs) return;
    lastSweep = t;
    for (const [key, keyHits] of hits) {
      if (t - keyHits[keyHits.length - 1] >= windowMs) hits.delete(key);
    }
  }
}

const TEN_MINUTES_MS = 10 * 60 * 1000;

// One limiter per AI route, shared by every request this instance serves.
/**
 * /api/coles-search spends the shared RapidAPI key's monthly quota (1,000 on
 * the free tier), so one account can't burn through it in a burst. High
 * enough for a new week's shopping list, which looks up each uncached
 * ingredient once (a week can be 70 or more); over it, prices fall back
 * to the static mapping.
 */
export const colesSearchRateLimiter = createRateLimiter({ limit: 150, windowMs: TEN_MINUTES_MS });

export const aiRateLimiters = {
  // A week is 7 parallel requests (#95) and each typed edit regenerates its nights (#38).
  generateRecipes: createRateLimiter({ limit: 40, windowMs: TEN_MINUTES_MS }),
  editPlan: createRateLimiter({ limit: 30, windowMs: TEN_MINUTES_MS }),
  scanPantryImage: createRateLimiter({ limit: 10, windowMs: TEN_MINUTES_MS }),
  extractRecipeFromImage: createRateLimiter({ limit: 10, windowMs: TEN_MINUTES_MS }),
  extractRecipeFromUrl: createRateLimiter({ limit: 20, windowMs: TEN_MINUTES_MS }),
  // The Coles extension imports order history each time its panel opens (#185).
  orderMatch: createRateLimiter({ limit: 10, windowMs: TEN_MINUTES_MS }),
};
