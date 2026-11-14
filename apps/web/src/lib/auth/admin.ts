/**
 * The app's owner(s), who alone can open the /debug and /admin pages and
 * the /api/debug routes. Set ADMIN_EMAILS (server-only) to a comma-separated
 * list. When it's unset, nobody is an admin: the pages fail closed.
 */
export function adminEmails(env: Record<string, string | undefined> = process.env): string[] {
  return (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/** True when `email` is one of ADMIN_EMAILS, ignoring case. */
export function isAdminEmail(email: string | null | undefined, env?: Record<string, string | undefined>): boolean {
  if (!email) return false;
  return adminEmails(env).includes(email.trim().toLowerCase());
}

/** Paths only an admin may open. */
export function isAdminPath(pathname: string): boolean {
  return /^\/(debug|admin)(\/|$)/.test(pathname);
}
