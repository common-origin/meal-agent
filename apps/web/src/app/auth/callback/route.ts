import { createClient } from '@/lib/supabase/server';
import { isSafeRedirectPath } from '@/lib/utils/url';
import { NextResponse } from 'next/server';

/**
 * Auth Callback Handler
 *
 * This route handles the OAuth callback from Google and magic link redirects.
 * It exchanges the auth code for a session and redirects to the app.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const origin = requestUrl.origin;
  const next = requestUrl.searchParams.get('next');
  const destination = isSafeRedirectPath(next) ? next : '/plan';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Error exchanging code for session:', error);
      // Forward the actual Supabase error code (e.g. otp_expired for a
      // stale magic link) rather than a fixed "auth_failed", so the login
      // page can render specific, friendly copy via getAuthErrorMessageForCode
      // instead of only ever showing its generic fallback.
      const errorCode = error.code ?? 'unexpected_failure';
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(errorCode)}`
      );
    }
  }

  // URL to redirect to after sign in process completes — the page the
  // user originally wanted (see proxy.ts's redirectTo param), falling
  // back to /plan if there wasn't one or it isn't safe to trust.
  return NextResponse.redirect(`${origin}${destination}`);
}
