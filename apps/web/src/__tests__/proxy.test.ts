import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const getUserMock = vi.fn();

// Captures the `global.fetch` wrapper proxy.ts builds (the one carrying its
// AbortController's signal), so the timeout test below can exercise the
// real abort wiring instead of a getUser() mock that's disconnected from it.
let capturedGlobalFetch: typeof fetch | undefined;

vi.mock('@supabase/ssr', () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: { global?: { fetch?: typeof fetch } }
  ) => {
    capturedGlobalFetch = options.global?.fetch;
    return {
      auth: {
        getUser: getUserMock,
      },
    };
  },
}));

import { proxy, config } from '../proxy';

function makeRequest(pathname: string): NextRequest {
  return new NextRequest(new URL(pathname, 'https://example.com'));
}

function locationOf(response: Response): URL | null {
  const location = response.headers.get('location');
  return location ? new URL(location) : null;
}

describe('proxy', () => {
  beforeEach(() => {
    getUserMock.mockReset();
  });

  describe('protected paths', () => {
    it.each(['/plan', '/shopping-list', '/recipes', '/settings', '/debug'])(
      'redirects an unauthenticated request to %s to /login with a redirectTo param',
      async (path) => {
        getUserMock.mockResolvedValue({ data: { user: null } });

        const response = await proxy(makeRequest(path));

        const location = locationOf(response);
        expect(location?.pathname).toBe('/login');
        expect(location?.searchParams.get('redirectTo')).toBe(path);
      }
    );

    it.each(['/plan', '/shopping-list', '/recipes', '/settings', '/debug'])(
      'lets an authenticated request through to %s',
      async (path) => {
        getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } } });

        const response = await proxy(makeRequest(path));

        expect(locationOf(response)).toBeNull();
      }
    );

    it('matches nested protected paths (e.g. /recipes/42), not just the exact prefix, and preserves the full path in redirectTo', async () => {
      getUserMock.mockResolvedValue({ data: { user: null } });

      const response = await proxy(makeRequest('/recipes/42'));

      const location = locationOf(response);
      expect(location?.pathname).toBe('/login');
      expect(location?.searchParams.get('redirectTo')).toBe('/recipes/42');
    });

    it("config.matcher covers every path in protectedPaths (including nested routes), so a regression here can't silently stop Next.js from invoking this proxy on a protected route", () => {
      const protectedPaths = ['/plan', '/shopping-list', '/recipes', '/settings', '/debug'];

      for (const path of protectedPaths) {
        // Next.js's `:path*` matches zero or more segments, so
        // `/plan/:path*` covers both `/plan` itself and `/plan/42`.
        expect(config.matcher).toContain(`${path}/:path*`);
      }
    });
  });

  describe('unprotected paths', () => {
    it('does not redirect an unauthenticated request to an unprotected path', async () => {
      getUserMock.mockResolvedValue({ data: { user: null } });

      const response = await proxy(makeRequest('/about'));

      expect(locationOf(response)).toBeNull();
    });

    it('does not redirect an authenticated request to an unprotected path either', async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } } });

      const response = await proxy(makeRequest('/about'));

      expect(locationOf(response)).toBeNull();
    });
  });

  describe('login/signup while authenticated', () => {
    it.each(['/login', '/signup'])(
      'redirects an authenticated visit to %s over to /plan',
      async (path) => {
        getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } } });

        const response = await proxy(makeRequest(path));

        expect(locationOf(response)?.pathname).toBe('/plan');
      }
    );

    it.each(['/login', '/signup'])(
      'lets an unauthenticated visit to %s through',
      async (path) => {
        getUserMock.mockResolvedValue({ data: { user: null } });

        const response = await proxy(makeRequest(path));

        expect(locationOf(response)).toBeNull();
      }
    );
  });

  describe('auth check timeout', () => {
    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    it('aborts the underlying fetch (not just the wait) and treats it as unauthenticated once the timeout elapses', async () => {
      vi.useFakeTimers();

      // A realistic fetch stand-in: it never settles on its own, but
      // rejects (like a real aborted fetch does) once its signal fires.
      const fetchSpy = vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          })
      );
      vi.stubGlobal('fetch', fetchSpy);

      // getUser() itself is still mocked (this file doesn't exercise real
      // supabase-js), but it now routes through the captured global.fetch
      // wrapper -- the same one the real GoTrueClient.getUser() would use
      // -- so aborting it actually unblocks this call, the way it does in
      // production, rather than the test relying on a separate timer race.
      getUserMock.mockImplementation(async () => {
        await capturedGlobalFetch!('https://example.supabase.co/auth/v1/user');
        throw new Error('unreachable: fetch should have rejected on abort');
      });

      const responsePromise = proxy(makeRequest('/plan'));
      await vi.advanceTimersByTimeAsync(3000);
      const response = await responsePromise;

      expect(locationOf(response)?.pathname).toBe('/login');
      expect(fetchSpy).toHaveBeenCalled();
    });
  });
});
