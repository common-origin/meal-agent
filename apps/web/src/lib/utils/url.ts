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
