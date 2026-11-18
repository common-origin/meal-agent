/**
 * The deployed release, for telemetry rows (admin dashboard, #244): the short
 * VERCEL_GIT_COMMIT_SHA that Vercel exposes by default, or 'dev' locally.
 */
export function release(env: Record<string, string | undefined> = process.env): string {
  const sha = env.VERCEL_GIT_COMMIT_SHA?.trim();
  return sha ? sha.slice(0, 7) : 'dev';
}
