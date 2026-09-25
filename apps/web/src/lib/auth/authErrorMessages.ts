import { isAuthError } from '@supabase/supabase-js';

/**
 * Known Supabase Auth error codes mapped to this app's own copy, so the
 * login/signup pages never render Supabase's internal error.message
 * verbatim. Only codes that can plausibly occur in this app's two auth
 * flows (Google OAuth + magic link -- there is no password flow) are
 * covered; everything else falls back to a single generic message.
 */
const KNOWN_ERROR_MESSAGES: Partial<Record<string, string>> = {
  otp_expired: 'That sign-in link has expired. Request a new one below.',
  otp_disabled: "Email sign-in isn't available right now. Please try again later.",
  over_email_send_rate_limit:
    'Too many sign-in emails requested. Please wait a few minutes and try again.',
  over_request_rate_limit: 'Too many attempts. Please wait a moment and try again.',
  email_address_invalid: "That doesn't look like a valid email address.",
  email_address_not_authorized: "This email address isn't allowed to sign in.",
  signup_disabled: "New sign-ups aren't available right now.",
  user_banned: 'This account has been disabled. Contact support if you think this is a mistake.',
  bad_oauth_state: 'Something went wrong connecting to Google. Please try again.',
  bad_oauth_callback: 'Something went wrong connecting to Google. Please try again.',
  oauth_provider_not_supported: 'Google sign-in is not available right now. Please try again later.',
  provider_disabled: 'Google sign-in is not available right now. Please try again later.',
};

/**
 * Turns a Supabase Auth error code into copy safe to render to the user.
 * Used both for an error caught directly client-side (via
 * getAuthErrorMessage below) and for a code forwarded through a redirect
 * query param -- e.g. auth/callback/route.ts, which hits its own
 * exchangeCodeForSession() error server-side and can only pass the code
 * along, not the original error object. `context` only affects the
 * wording of the generic fallback for an unrecognized/missing code.
 */
export function getAuthErrorMessageForCode(
  code: string | null | undefined,
  context: 'sign in' | 'sign up' = 'sign in'
): string {
  const known = code ? KNOWN_ERROR_MESSAGES[code] : undefined;
  if (known) return known;

  return `Something went wrong trying to ${context}. Please try again.`;
}

/**
 * Turns a caught sign-in/sign-up error into copy safe to render to the
 * user -- never the raw error.message.
 */
export function getAuthErrorMessage(
  error: unknown,
  context: 'sign in' | 'sign up' = 'sign in'
): string {
  return getAuthErrorMessageForCode(isAuthError(error) ? error.code : undefined, context);
}
