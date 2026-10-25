'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Box, Button, Stack, TextField, Typography, tokens } from '@common-origin/design-system';
import { createClient } from '@/lib/supabase/client';
import { getSiteUrl, isSafeRedirectPath } from '@/lib/utils/url';
import { getAuthErrorMessage, getAuthErrorMessageForCode } from '@/lib/auth/authErrorMessages';

type LoginFormProps = {
  /** Where to go after sign-in (set by proxy.ts's login redirect). */
  redirectTo: string | null;
  /** An error code from auth/callback/route.ts. */
  errorCode: string | null;
  /**
   * The prerendered stand-in before hydration: shown, but disabled, so a
   * native submit can't reload the page without the URL's values.
   */
  pending?: boolean;
};

function LoginForm({ redirectTo, errorCode, pending = false }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // auth/callback/route.ts redirects here with ?error=<code> when
  // exchangeCodeForSession() fails server-side (e.g. an expired magic
  // link) -- render the same friendly copy for it as for an error caught
  // directly client-side below.
  useEffect(() => {
    if (errorCode) {
      setError(getAuthErrorMessageForCode(errorCode, 'sign in'));
    }
  }, [errorCode]);

  // Forward the page the user originally wanted (set by proxy.ts's login
  // redirect) through the OAuth/magic-link round trip via `next`, so
  // auth/callback/route.ts can send them back to it after sign-in.
  const callbackUrl = isSafeRedirectPath(redirectTo)
    ? `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(redirectTo)}`
    : `${getSiteUrl()}/auth/callback`;

  // Keep it attached when switching to signup too, so a visitor who lands
  // here first doesn't lose the deep link by using that link instead.
  const signupHref = isSafeRedirectPath(redirectTo)
    ? `/signup?redirectTo=${encodeURIComponent(redirectTo)}`
    : '/signup';

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl,
        },
      });

      if (error) throw error;
    } catch (err) {
      setError(getAuthErrorMessage(err, 'sign in'));
      setLoading(false);
    }
  };

  const handleMagicLinkSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setError('Please enter your email');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: callbackUrl,
        },
      });

      if (error) throw error;

      setSuccess(true);
    } catch (err) {
      setError(getAuthErrorMessage(err, 'sign in'));
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Box
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <Box bg="subtle" border="default" borderRadius="lg" p="xl" style={{ maxWidth: '400px', width: '100%' }}>
          <Stack direction="column" gap="lg">
            <Typography variant="h2">Check your email</Typography>
            <Typography color="subdued">
              We&apos;ve sent a magic link to <strong>{email}</strong>
            </Typography>
            <Typography color="subdued">
              Click the link in the email to sign in. You can close this window.
            </Typography>
            <Button
              variant="secondary"
              onClick={() => {
                setSuccess(false);
                setEmail('');
                setLoading(false);
              }}
            >
              Use a different email
            </Button>
          </Stack>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <Box bg="subtle" border="default" borderRadius="lg" p="xl" style={{ maxWidth: '400px', width: '100%' }}>
        <Stack direction="column" gap="lg">
          <Stack direction="column" gap="sm">
            <Typography variant="h2">Welcome back</Typography>
            <Typography color="subdued">
              Sign in to your meal planning account
            </Typography>
          </Stack>

          {error && (
            <Box
              bg="error-subtle"
              border="error"
              borderRadius="sm"
              p="md"
            >
              <Typography>{error}</Typography>
            </Box>
          )}

          <Button
            onClick={handleGoogleSignIn}
            disabled={loading || pending}
            style={{ width: '100%' }}
          >
            {loading ? 'Signing in...' : 'Continue with Google'}
          </Button>

          <Box style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '8px' }}>
            <Box style={{ flex: 1, height: '1px', backgroundColor: tokens.semantic.color.border.default }} />
            <Typography color="subdued">or</Typography>
            <Box style={{ flex: 1, height: '1px', backgroundColor: tokens.semantic.color.border.default }} />
          </Box>

          <form onSubmit={handleMagicLinkSignIn}>
            <Stack direction="column" gap="md">
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={loading || pending}
                required
              />
              <Button
                type="submit"
                variant="secondary"
                disabled={loading || pending}
                style={{ width: '100%' }}
              >
                {loading ? 'Sending link...' : 'Send magic link'}
              </Button>
            </Stack>
          </form>

          <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="subdued">
              Don&apos;t have an account?{' '}
              <Button
                variant="naked"
                onClick={() => router.push(signupHref)}
                disabled={loading || pending}
              >
                Sign up
              </Button>
            </Typography>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}

/** The form with the URL's redirect target and error code. */
function LoginFormFromUrl() {
  const searchParams = useSearchParams();
  return <LoginForm redirectTo={searchParams.get('redirectTo')} errorCode={searchParams.get('error')} />;
}

export default function LoginPage() {
  // useSearchParams() makes the static prerender render the fallback (#164),
  // so the fallback is the form itself without the URL's values, not
  // nothing: the page arrives with its content and styles.
  return (
    <Suspense fallback={<LoginForm redirectTo={null} errorCode={null} pending />}>
      <LoginFormFromUrl />
    </Suspense>
  );
}
