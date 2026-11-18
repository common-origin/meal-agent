/**
 * Turns a URL path into a route pattern, so telemetry never stores an actual
 * path (a path can carry a recipe ID, which embeds a title, or a secret
 * token). The query string and hash are always dropped.
 *
 * Segments already written as a Next route pattern (`[token]`) are kept.
 * Everything below a known dynamic parent (`/recipe/*`, `/join/*`,
 * `/api/plan/ics/*`) becomes `[param]`, and so does any other segment that
 * looks like an identifier (uuid, long token, anything containing digits, or
 * a hyphenated slug). Unfamiliar-but-plain words stay, e.g. `/settings`.
 */

const DYNAMIC_PARENTS = ['/recipe', '/join', '/api/plan/ics'];

const PARAM = '[param]';

function looksLikeIdentifier(segment: string): boolean {
  if (/\d/.test(segment)) return true;
  if (segment.length >= 20) return true;
  // A slug such as a recipe ID: several words joined by hyphens.
  if ((segment.match(/-/g) ?? []).length >= 2) return true;
  return false;
}

export function routePattern(path: string): string {
  // Anything after ? or # is never kept. Decode failures (malformed %) are fine: the segment is replaced if it looks odd.
  const pathname = path.split(/[?#]/, 1)[0] ?? '';
  const segments = pathname.split('/').filter((segment) => segment.length > 0);
  if (segments.length === 0) return '/';

  const out: string[] = [];
  for (const [index, segment] of segments.entries()) {
    const parent = '/' + out.join('/');
    // A parent counts as dynamic only when its own segments were literal (not already a param).
    if (index > 0 && DYNAMIC_PARENTS.some((p) => parent.endsWith(p)) && !/^\[.+\]$/.test(segment)) {
      out.push(PARAM);
      continue;
    }
    if (/^\[.+\]$/.test(segment)) {
      out.push(segment);
    } else if (looksLikeIdentifier(segment)) {
      out.push(PARAM);
    } else {
      out.push(segment);
    }
  }
  return '/' + out.join('/');
}
