/**
 * Get the site URL for redirects
 * Uses NEXT_PUBLIC_SITE_URL in production, falls back to window.location.origin
 */
export function getSiteUrl(): string {
  // In production (Vercel), use the VERCEL_URL or custom domain
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  
  // Check for Vercel deployment URL
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
