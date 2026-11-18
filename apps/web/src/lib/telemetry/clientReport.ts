/**
 * Reports a browser-side error to /api/telemetry/client-error (admin
 * dashboard, #246). Client only, and free of node-only imports so it can run
 * from instrumentation-client.ts.
 *
 * - The page path goes through routePattern(), so a recipe ID or token in the
 *   URL is never sent; the message is scrubbed here as well as on the server.
 * - Duplicates (same kind, message and route) are sent once per page load, and
 *   at most MAX_PER_PAGE_LOAD reports are sent per page load.
 * - Only the top stack frame is sent.
 * - Reporting never throws and never surfaces: signed-out users get a 401
 *   from the server and that is fine.
 */

import { routePattern } from './routePattern';
import { scrub } from './scrub';
import { errorKind, errorMessage, topFrameOf } from './errorRow';

export const CLIENT_ERROR_ENDPOINT = '/api/telemetry/client-error';
export const MAX_PER_PAGE_LOAD = 5;

/** Browser noise that isn't an app bug. */
const IGNORED_MESSAGES = [
  /^ResizeObserver loop/i,
  /^Script error\.?$/i,
  // The network or the user cancelling, not a bug in the app.
  /^(Failed to fetch|Load failed|NetworkError|The operation was aborted|signal is aborted)/i,
  /^The user aborted a request/i,
];

const seen = new Set<string>();
let sent = 0;

/** For tests: forget what this page load has already reported. */
export function resetClientReporting(): void {
  seen.clear();
  sent = 0;
}

export interface ClientErrorBody {
  kind: string;
  message: string;
  route: string;
  topFrame?: string;
}

export function buildClientErrorBody(error: unknown, pathname: string): ClientErrorBody {
  const body: ClientErrorBody = {
    kind: errorKind(error),
    message: scrub(errorMessage(error)),
    route: routePattern(pathname),
  };
  const topFrame = error instanceof Error ? topFrameOf(error.stack) : undefined;
  if (topFrame) body.topFrame = topFrame;
  return body;
}

/**
 * Sends `error` once per page load. Pass `digest` when the error came from
 * Next's error boundaries: an error with a digest is a server error that
 * onRequestError already captured, so it is skipped.
 */
export function reportClientError(error: unknown, options: { digest?: string | null } = {}): void {
  try {
    if (options.digest) return;
    if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
    if (typeof error === 'object' && error !== null && 'digest' in error && (error as { digest?: unknown }).digest) return;

    const body = buildClientErrorBody(error, window.location.pathname);
    // A rejection with no reason (Promise.reject()) has nothing to group by.
    if (!body.message || IGNORED_MESSAGES.some((pattern) => pattern.test(body.message))) return;
    if (body.kind === 'AbortError') return;
    const key = `${body.kind}|${body.message}|${body.route}`;
    if (seen.has(key) || sent >= MAX_PER_PAGE_LOAD) return;
    seen.add(key);
    sent += 1;

    void fetch(CLIENT_ERROR_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Telemetry never breaks the page.
  }
}
