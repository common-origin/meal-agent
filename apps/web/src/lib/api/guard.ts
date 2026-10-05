/**
 * Shared request guards for AI API routes: auth, rate limit, body validation.
 *
 * Each returns either the value the route needs or a ready-made error
 * response, so a route reads as a short sequence of early returns.
 */

import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import type { z } from 'zod';
import { getCurrentUser } from '@/lib/supabase/server';
import type { RateLimiter } from './rateLimit';

type Guarded<T> = { ok: true; value: T } | { ok: false; response: NextResponse };

export function unauthenticatedResponse(): NextResponse {
  return NextResponse.json(
    { error: 'Please sign in to use this feature.', code: 'unauthenticated' },
    { status: 401 }
  );
}

export function rateLimitedResponse(): NextResponse {
  return NextResponse.json(
    { error: "You've hit the limit for now. Try again in a few minutes.", code: 'rate_limited' },
    { status: 429 }
  );
}

export function invalidRequestResponse(): NextResponse {
  return NextResponse.json(
    { error: 'Something was wrong with that request.', code: 'invalid_request' },
    { status: 400 }
  );
}

/** 504 for an AI call that hit its deadline; logs it so deadline hits show up server-side. */
export function timeoutResponse(route: string): NextResponse {
  console.warn(`${route}: AI call hit its deadline, returning 504`);
  return NextResponse.json(
    { error: 'That took too long. Please try again.', code: 'timeout' },
    { status: 504 }
  );
}

/** Signed-in user, counted against `limiter`. */
export async function requireUserWithinLimit(limiter: RateLimiter): Promise<Guarded<User>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, response: unauthenticatedResponse() };
  if (!limiter.check(user.id)) return { ok: false, response: rateLimitedResponse() };
  return { ok: true, value: user };
}

/** Parses `body` with `schema`; logs the issues server-side on failure. */
export function parseBody<S extends z.ZodType>(
  schema: S,
  body: unknown,
  route: string
): Guarded<z.output<S>> {
  const result = schema.safeParse(body);
  if (!result.success) {
    console.warn(`${route}: invalid request body`, result.error.issues);
    return { ok: false, response: invalidRequestResponse() };
  }
  return { ok: true, value: result.data };
}

/** Request JSON, or undefined if the body isn't valid JSON (fails schema parsing). */
export async function readJson(request: Request): Promise<unknown> {
  return request.json().catch(() => undefined);
}
