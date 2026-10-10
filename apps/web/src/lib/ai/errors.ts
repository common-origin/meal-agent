/**
 * The one error contract for every AI route (#96): `{ error, code }`.
 *
 * `error` is always friendly copy from this table; raw errors (SDK messages,
 * provider statuses, stack traces) are only ever logged server-side. There
 * is no `details` field.
 */

import { NextResponse } from 'next/server';
import { AiTaskError } from './run';

const UNREADABLE_PAGE = "We couldn't read that page. Check the link or add the recipe manually.";

export const AI_ERRORS = {
  unauthenticated: { status: 401, message: 'Please sign in to use this feature.' },
  rate_limited: { status: 429, message: "You've hit the limit for now. Try again in a few minutes." },
  daily_cap: { status: 429, message: "You've reached today's AI limit. It resets tomorrow." },
  provider_busy: { status: 503, message: 'The AI service is busy right now. Please try again in a minute.' },
  timeout: { status: 504, message: 'That took too long. Please try again.' },
  invalid_output: { status: 502, message: "The AI returned something we couldn't read. Please try again." },
  invalid_request: { status: 400, message: 'Something was wrong with that request.' },
  recitation: { status: 422, message: "We couldn't read this page automatically. Please add the recipe manually." },
  blocked: { status: 422, message: "We couldn't process this photo. Try a different one." },
  image_too_large: { status: 413, message: 'That photo is too large. Try a smaller one.' },
  unknown: { status: 500, message: 'Something went wrong. Please try again.' },
} as const satisfies Record<string, { status: number; message: string }>;

export type AiErrorCode = keyof typeof AI_ERRORS;

export interface AiErrorBody {
  error: string;
  code: AiErrorCode | string;
}

/**
 * The response for `code`. `message` replaces the default copy where a route
 * needs wording of its own (e.g. a blocked URL or generation request); it
 * must be friendly copy, never a raw error.
 */
export function aiErrorResponse(code: AiErrorCode, options: { message?: string } = {}): NextResponse<AiErrorBody> {
  const entry = AI_ERRORS[code];
  return NextResponse.json({ error: options.message ?? entry.message, code }, { status: entry.status });
}

/**
 * URL import couldn't fetch the page. `code` is the SafeFetchError code
 * (`invalid_url`, `blocked_host`, `timeout`, `too_large`, `not_html`,
 * `http_error`); every one gets the same friendly copy.
 */
export function unreadablePageResponse(code: string): NextResponse<AiErrorBody> {
  const status = code === 'invalid_url' || code === 'blocked_host' ? 400 : 422;
  return NextResponse.json({ error: UNREADABLE_PAGE, code }, { status });
}

/** Classifies a thrown error. Anything unrecognised is `unknown`. */
export function toAiErrorCode(error: unknown): AiErrorCode {
  if (!(error instanceof AiTaskError)) return 'unknown';
  switch (error.code) {
    case 'timeout':
      return 'timeout';
    case 'invalid_output':
      return 'invalid_output';
    // The provider's 429 or 5xx, after the SDK's retries: not the user's own limit.
    case 'rate_limited':
    case 'unavailable':
      return 'provider_busy';
    default:
      return 'unknown';
  }
}

/** Logs the raw error server-side and returns the friendly response for it. */
export function aiFailureResponse(error: unknown, route: string): NextResponse<AiErrorBody> {
  const code = toAiErrorCode(error);
  if (code === 'timeout') console.warn(`${route}: AI call hit its deadline, returning 504`);
  else if (code === 'invalid_output') console.warn(`${route}: AI output failed schema validation twice, returning 502`);
  else console.error(`${route}: request failed (${code})`, error);
  return aiErrorResponse(code);
}
