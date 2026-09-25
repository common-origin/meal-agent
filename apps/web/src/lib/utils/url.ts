/**
 * Get the site URL for redirects
 * Uses NEXT_PUBLIC_SITE_URL in production, falls back to window.location.origin
 */
export function getSiteUrl(): string {
  // In production (Vercel), use the VERCEL_URL or custom domain
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  
  // Check for Vercel deployment URL. Note: on a preview deployment this
  // resolves to that deployment's own unique per-branch URL, which is
  // essentially never on Supabase Auth's redirect allow-list (Auth
  // settings -> Redirect URLs) -- that list only has the production
  // domain and localhost. This is a deliberate, known gap (issue #59),
  // not a bug: it means Google/magic-link sign-in doesn't complete on
  // preview deployments (Supabase rejects the redirect, so this fails
  // safe rather than open), so don't spend time debugging "why doesn't
  // sign-in work on my preview deploy" -- it isn't expected to. Wildcarding
  // the allow-list for *.vercel.app previews would fix this but is a
  // deliberate security trade-off for whoever owns the Supabase project
  // to decide, not something to do silently here.
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }
  
  // Fallback to window.location.origin (development)
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // Final fallback
  return 'http://localhost:3000';
}

/**
 * Whether a redirect target is safe to send the browser to after auth —
 * a same-origin relative path only. Rejects anything that could act as an
 * open redirect (an absolute URL, or a protocol-relative "//host/path" or
 * "/\host/path", both of which browsers can resolve to a different origin).
 */
export function isSafeRedirectPath(path: string | null | undefined): path is string {
  if (!path) return false;
  if (!path.startsWith('/')) return false;
  if (path.startsWith('//') || path.startsWith('/\\')) return false;
  return true;
}
