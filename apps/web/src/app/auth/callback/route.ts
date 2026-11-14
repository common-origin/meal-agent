import { createClient } from '@/lib/supabase/server';
import { isSafeRedirectPath } from '@/lib/utils/url';
import { isSignupRefused } from '@/lib/auth/authErrorMessages';
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

  // A failed OAuth signup comes back with an error and no code, e.g. the
  // invite check refusing it (migration 013). Send it to the login page
  // rather than on to the app, which would only bounce it there unexplained.
  const providerError = requestUrl.searchParams.get('error');
  if (!code && providerError) {
    const description = requestUrl.searchParams.get('error_description');
    const errorCode = isSignupRefused(description)
      ? 'not_invited'
      : (requestUrl.searchParams.get('error_code') ?? providerError);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorCode)}`);
  }

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
