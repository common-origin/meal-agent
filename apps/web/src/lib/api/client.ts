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
