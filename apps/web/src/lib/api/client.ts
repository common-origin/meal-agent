/**
 * Client-side helpers for calling our API routes.
 */

/**
 * If the response is a 401 (session expired or signed out), sends the user
 * to log in and back to this page afterwards — the same redirect proxy.ts
 * uses for protected pages. Returns true when it redirected, so the caller
 * can stop handling the response.
 */
export function redirectToLoginIfUnauthenticated(response: Response): boolean {
  if (response.status !== 401) return false;
  window.location.assign(`/login?redirectTo=${encodeURIComponent(window.location.pathname)}`);
  return true;
}

/** The browser's IANA time zone, sent with generate requests so the season is local (#87). */
export function clientTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

/** Shown when a response carries no friendly `error` (e.g. a platform error page). */
export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

/**
 * The friendly message from an AI route's `{ error, code }` body (#96), or a
 * generic one. Never shows raw response text.
 */
export function apiErrorMessage(data: unknown): string {
  const error = (data as { error?: unknown } | null)?.error;
  return typeof error === 'string' && error.trim() ? error : GENERIC_ERROR_MESSAGE;
}

