/**
 * Next.js Proxy for Supabase Authentication
 *
 * This proxy:
 * 1. Refreshes the user's session automatically
 * 2. Protects routes that require authentication
 * 3. Redirects unauthenticated users to login
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshing the auth token — raced against a timeout so a slow or
  // unresponsive Supabase Auth call can't hang this proxy invocation
  // and take down the whole site with a 504 (see issue #19). A timeout is
  // treated the same as "no user", the same safe fallback used on an
  // actual auth failure.
  const AUTH_TIMEOUT_MS = 3000;
  const authResult = await Promise.race([
    supabase.auth.getUser(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), AUTH_TIMEOUT_MS)),
  ]);
  const user = authResult?.data.user ?? null;

  // Protected routes - require authentication
  const protectedPaths = [
    '/plan',
    '/shopping-list',
    '/recipes',
    '/settings',
    '/debug',
  ];

  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  // Redirect to login if accessing protected route without auth
  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Redirect to plan if accessing login/signup while authenticated
  if ((request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup') && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/plan';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  // Scoped to exactly the paths this proxy needs to act on: the
  // protected routes it may redirect away from, and /login + /signup (for
  // the reverse redirect when an authenticated user visits them). Every
  // other route — the homepage, /about, /recipe/[id], etc. — needs no auth
  // check at all, so it skips this proxy (and the Supabase call
  // inside it) entirely. Previously this matched nearly every route,
  // meaning a slow Supabase Auth response could 504 the entire site
  // instead of just the pages that actually require a session (issue #19).
  matcher: [
    '/plan/:path*',
    '/shopping-list/:path*',
    '/recipes/:path*',
    '/settings/:path*',
    '/debug/:path*',
    '/login',
    '/signup',
  ],
};
