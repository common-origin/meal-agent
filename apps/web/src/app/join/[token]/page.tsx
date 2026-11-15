"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Alert, Box, Button, Stack, Typography } from "@common-origin/design-system";
import type { InvitePreview } from "@/lib/household/members";
import { clearHouseholdScopedCaches } from "@/lib/storage";

/**
 * /join/<token> (#217): the link in a household invite email. The proxy
 * signs people in first. A new user with a pending invite has already
 * joined at signup, so they see "You're in"; an existing user confirms,
 * since joining replaces their own household.
 */
export default function JoinHouseholdPage() {
  const { token } = useParams<{ token: string }>();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    fetch(`/api/household/join?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (res.status === 404) return setPreview({ status: 'not_found', inviteEmail: null, inviterEmail: null, emailMatches: false, alreadyMember: false, soleMember: false });
        if (!res.ok) throw new Error(body?.error ?? 'Something went wrong. Please try again.');
        setPreview(body as InvitePreview);
      })
      .catch((e: Error) => setError(e.message));
  }, [token]);

  const join = async () => {
    setJoining(true);
    setError(null);
    const res = await fetch('/api/household/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).catch(() => null);
    const body = await res?.json().catch(() => ({}));
    if (!res?.ok) {
      setError(body?.error ?? 'Something went wrong. Please try again.');
      setJoining(false);
      return;
    }
    // The old household's cached plans and recipes go, and a full load starts fresh.
    clearHouseholdScopedCaches();
    window.location.assign('/plan');
  };

  const inviter = preview?.inviterEmail ?? 'someone';

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <Box bg="surface.raised" border="default" borderRadius="lg" p="xl" style={{ maxWidth: '440px', width: '100%' }}>
        <Stack direction="column" gap="lg">
          {error && <Alert variant="error">{error}</Alert>}

          {!preview && !error && <Typography color="subdued">Checking your invite…</Typography>}

          {preview?.alreadyMember && (
            <>
              <Typography variant="h2">You&apos;re in</Typography>
              <Typography>You&apos;re part of {inviter}&apos;s household. Its plans, recipes and shopping list are yours too.</Typography>
              <Link href="/plan"><Button>Go to your plan</Button></Link>
            </>
          )}

          {preview && !preview.alreadyMember && preview.status !== 'valid' && (
            <>
              <Typography variant="h2">This invite can&apos;t be used</Typography>
              <Typography>
                {preview.status === 'expired'
                  ? 'It has expired. Ask whoever invited you to send a new one.'
                  : preview.status === 'accepted'
                    ? 'It has already been used.'
                    : "We couldn't find it. Check you used the whole link from the email."}
              </Typography>
              <Link href="/plan"><Button variant="secondary">Go to your plan</Button></Link>
            </>
          )}

          {preview && !preview.alreadyMember && preview.status === 'valid' && !preview.emailMatches && (
            <>
              <Typography variant="h2">Wrong account</Typography>
              <Typography>
                This invite is for {preview.inviteEmail}. Sign out, then sign in with that email to join.
              </Typography>
              <Link href="/plan"><Button variant="secondary">Go to your plan</Button></Link>
            </>
          )}

          {preview && !preview.alreadyMember && preview.status === 'valid' && preview.emailMatches && (
            <>
              <Typography variant="h2">Join {inviter}&apos;s household?</Typography>
              <Typography>You&apos;ll share their plans, recipes, shopping list and settings.</Typography>
              <Alert variant="warning" appearance="borderless">
                {preview.soleMember
                  ? 'Your own plans, recipes, shopping list and settings will be deleted. This can’t be undone.'
                  : "You'll leave your current household. Its other members keep it."}
              </Alert>
              <Stack direction="row" gap="md">
                <Button onClick={join} disabled={joining}>{joining ? 'Joining…' : 'Join household'}</Button>
                <Link href="/plan"><Button variant="secondary" disabled={joining}>Not now</Button></Link>
              </Stack>
            </>
          )}
        </Stack>
      </Box>
    </main>
  );
}
