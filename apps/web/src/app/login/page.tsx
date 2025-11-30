'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Button, Stack, TextField, Typography } from '@common-origin/design-system';
import { createClient } from '@/lib/supabase/client';
import { getSiteUrl } from '@/lib/utils/url';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${getSiteUrl()}/auth/callback`,
        },
      });

      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in with Google');
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
          emailRedirectTo: `${getSiteUrl()}/auth/callback`,
        },
      });

      if (error) throw error;
      
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send magic link');
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
        <Box bg="surface" border="default" borderRadius="4" p="xl" style={{ maxWidth: '400px', width: '100%' }}>
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
      <Box bg="surface" border="default" borderRadius="4" p="xl" style={{ maxWidth: '400px', width: '100%' }}>
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
              borderRadius="2"
              p="md"
            >
              <Typography>{error}</Typography>
            </Box>
          )}

          <Button
            onClick={handleGoogleSignIn}
            disabled={loading}
            style={{ width: '100%' }}
          >
            {loading ? 'Signing in...' : 'Continue with Google'}
          </Button>

          <Box style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '8px' }}>
            <Box style={{ flex: 1, height: '1px', backgroundColor: '#e0e0e0' }} />
            <Typography color="subdued">or</Typography>
            <Box style={{ flex: 1, height: '1px', backgroundColor: '#e0e0e0' }} />
          </Box>

          <form onSubmit={handleMagicLinkSignIn}>
            <Stack direction="column" gap="md">
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={loading}
                required
              />
              <Button
                type="submit"
                variant="secondary"
                disabled={loading}
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
                onClick={() => router.push('/signup')}
                disabled={loading}
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
