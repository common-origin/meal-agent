/**
 * Links out of /admin to the Supabase and Vercel dashboards. Non-secret:
 * the Supabase project ref is the first label of NEXT_PUBLIC_SUPABASE_URL
 * (which the browser already receives), and the Vercel project URL is a
 * constant that ADMIN_VERCEL_PROJECT_URL can override.
 */

import type { ActionTarget, AttentionAction, AttentionSection } from './types';

export const DEFAULT_VERCEL_PROJECT_URL = 'https://vercel.com/commonorigins-projects/meal-agent';
export const GITHUB_REPO_URL = 'https://github.com/common-origin/meal-agent';

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

/** Where attention actions and error "investigate" links go. A Supabase target is null when the URL isn't a hosted project. */
export interface AdminLinkTargets {
  vercelProject: string;
  vercelLogs: string;
  supabaseSql: string | null;
  supabasePerformance: string | null;
  uptimeWorkflow: string;
  githubRepo: string;
}

export interface AdminLinks {
  targets: AdminLinkTargets;
  supabase: AdminLink[];
  vercel: AdminLink[];
  debug: AdminLink[];
}

/**
 * Server-only: call it from the page (`app/admin/page.tsx`) and pass the result
 * down as a prop. The env is a required argument, not a `process.env` default,
 * because a client component that read `process.env` here would see an empty
 * object in the browser, render different links from the server's HTML and
 * trigger a hydration mismatch (React #418).
 */
export function adminLinks(env: Record<string, string | undefined>): AdminLinks {
  const ref = supabaseProjectRef(env.NEXT_PUBLIC_SUPABASE_URL);
  const project = ref ? `https://supabase.com/dashboard/project/${ref}` : null;
  const vercel = env.ADMIN_VERCEL_PROJECT_URL?.trim() || DEFAULT_VERCEL_PROJECT_URL;
  const vercelLogs = `${vercel.replace(/\/$/, '')}/logs`;
  return {
    targets: {
      vercelProject: vercel,
      vercelLogs,
      supabaseSql: project ? `${project}/sql/new` : null,
      supabasePerformance: project ? `${project}/observability/query-performance` : null,
      uptimeWorkflow: `${GITHUB_REPO_URL}/actions/workflows/uptime.yml`,
      githubRepo: GITHUB_REPO_URL,
    },
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
      { label: 'Runtime logs', href: vercelLogs },
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

export interface ResolvedAction {
  label: string;
  href: string;
  /** Opens another site (Vercel, Supabase, GitHub): the link opens in a new tab. */
  external: boolean;
}

/** An attention action as a link, or null when its target can't be built (no hosted Supabase project to link to). */
export function resolveAction(action: AttentionAction, section: AttentionSection, links: AdminLinks): ResolvedAction | null {
  const { targets } = links;
  const hrefs: Record<ActionTarget, string | null> = {
    section: `#${section}`,
    'vercel-logs': targets.vercelLogs,
    'vercel-project': targets.vercelProject,
    'supabase-sql': targets.supabaseSql,
    'supabase-performance': targets.supabasePerformance,
    'uptime-workflow': targets.uptimeWorkflow,
  };
  const href = hrefs[action.target];
  return href ? { label: action.label, href, external: action.target !== 'section' } : null;
}
