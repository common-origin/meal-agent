/**
 * Links out of /admin to the Supabase and Vercel dashboards. Non-secret:
 * the Supabase project ref is the first label of NEXT_PUBLIC_SUPABASE_URL
 * (which the browser already receives), and the Vercel project URL is a
 * constant that ADMIN_VERCEL_PROJECT_URL can override.
 */

export const DEFAULT_VERCEL_PROJECT_URL = 'https://vercel.com/commonorigins-projects/meal-agent';

/** `https://abcd.supabase.co` -> `abcd`; null for anything else (a local or self-hosted URL). */
export function supabaseProjectRef(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const { hostname } = new URL(url);
    const match = /^([a-z0-9]+)\.supabase\.(?:co|com)$/.exec(hostname);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export interface AdminLink {
  label: string;
  href: string;
}

export function adminLinks(env: Record<string, string | undefined> = process.env): { supabase: AdminLink[]; vercel: AdminLink[]; debug: AdminLink[] } {
  const ref = supabaseProjectRef(env.NEXT_PUBLIC_SUPABASE_URL);
  const project = ref ? `https://supabase.com/dashboard/project/${ref}` : null;
  const vercel = env.ADMIN_VERCEL_PROJECT_URL?.trim() || DEFAULT_VERCEL_PROJECT_URL;
  return {
    supabase: project
      ? [
          { label: 'Query performance', href: `${project}/observability/query-performance` },
          { label: 'Performance advisor', href: `${project}/advisors/performance` },
          { label: 'Security advisor', href: `${project}/advisors/security` },
          { label: 'SQL editor', href: `${project}/sql/new` },
        ]
      : [],
    vercel: [
      { label: 'Vercel project', href: vercel },
      { label: 'Runtime logs', href: `${vercel.replace(/\/$/, '')}/logs` },
    ],
    debug: [
      { label: 'API usage', href: '/debug/api-usage' },
      { label: 'Coles API test', href: '/debug/coles-api-test' },
      { label: 'Ingredient analytics', href: '/debug/ingredient-analytics' },
      { label: 'Persistent cache', href: '/debug/persistent-cache' },
      { label: 'Search mapping', href: '/debug/search-mapping' },
      { label: 'Analytics events (this browser)', href: '/admin/debug' },
    ],
  };
}
