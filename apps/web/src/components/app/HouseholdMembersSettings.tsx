"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Chip, Modal, Stack, TextField, Typography } from "@common-origin/design-system";
import SettingsSection from "./SettingsSection";
import { INVITE_DAYS, MAX_HOUSEHOLD_PEOPLE, type HouseholdMembersResponse } from "@/lib/household/members";
import { clearHouseholdScopedCaches } from "@/lib/storage";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init).catch(() => null);
  const body = await res?.json().catch(() => ({}));
  if (!res?.ok) throw new Error(body?.error ?? 'Something went wrong. Please try again.');
  return body as T;
}

/**
 * Settings → Household members (#217): who's in the household, pending
 * invites, and (for the owner) inviting and removing people. Laid out like
 * Recipe sharing: a card per person, and a dialog to add one.
 */
export default function HouseholdMembersSettings() {
  const [data, setData] = useState<HouseholdMembersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [busy, setBusy] = useState(false);
  /** The link to pass on by hand when the invite email couldn't be sent. */
  const [shareLink, setShareLink] = useState<string | null>(null);

  const load = useCallback(
    () => request<HouseholdMembersResponse>('/api/household/members').then(setData, (e: Error) => setError(e.message)),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);

  const members = data?.members ?? [];
  const invites = data?.invites ?? [];
  const me = members.find((m) => m.isMe);
  const isOwner = me?.role === 'owner';
  const atCap = members.length + invites.length >= MAX_HOUSEHOLD_PEOPLE;
  const newEmail = inviteEmail.trim();
  const emailError = newEmail && !EMAIL_RE.test(newEmail) ? 'Enter a valid email address' : undefined;

  const act = async (work: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await work();
      if (done) setNotice(done);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const sendInvite = () =>
    act(async () => {
      const result = await request<{ emailed: boolean; joinUrl?: string }>('/api/household/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail }),
      });
      setInviteOpen(false);
      setShareLink(result.emailed ? null : result.joinUrl ?? null);
      setNotice(result.emailed ? `Invite sent to ${newEmail}.` : `Invite created for ${newEmail}, but the email couldn't be sent. Share the link below.`);
    });

  const cancelInvite = (id: string, email: string) =>
    act(() => request(`/api/household/invites?id=${encodeURIComponent(id)}`, { method: 'DELETE' }), `Invite to ${email} cancelled.`);

  const removeMember = (userId: string, email: string, isMe: boolean) => {
    const question = isMe
      ? "Leave this household? You'll start a new, empty household of your own and set it up again."
      : `Remove ${email}? They'll start a new, empty household of their own.`;
    if (!window.confirm(question)) return;
    act(async () => {
      await request(`/api/household/members?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' });
      // Leaving moves you to a new household: drop the old one's cached data and
      // start again from the plan, which sends you to setup.
      if (isMe) {
        clearHouseholdScopedCaches();
        window.location.assign('/plan');
      }
    }, isMe ? undefined : `${email} was removed.`);
  };

  return (
    <SettingsSection
      title="Household members"
      description={`Everyone in a household shares its plans, recipes, shopping list and settings. Up to ${MAX_HOUSEHOLD_PEOPLE} people.`}
    >
      <Stack direction="column" gap="2xl">
        {error && (
          <Alert variant="error" dismissible onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}
        {notice && (
          <Alert variant="success" dismissible onDismiss={() => setNotice(null)}>
            {notice}
          </Alert>
        )}
        {shareLink && (
          <Box border="default" borderRadius="md" p="md">
            <Stack direction="row" gap="md" justifyContent="space-between" alignItems="center">
              <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                <Typography variant="small" color="subdued">{shareLink}</Typography>
              </div>
              <Button variant="secondary" size="small" onClick={() => navigator.clipboard.writeText(shareLink)}>
                Copy link
              </Button>
            </Stack>
          </Box>
        )}

        {!data && !error && <Typography color="subdued">Loading your household…</Typography>}

        {data && (
          <Stack direction="column" gap="sm">
            {members.map((m) => (
              <Box key={m.userId} border="default" borderRadius="md" p="md" bg="color.fill.muted">
                <Stack direction="row" gap="md" justifyContent="space-between" alignItems="center">
                  <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                    <Stack direction="column" gap="xs">
                      <Typography variant="body"><strong>{m.isMe ? `${m.email} (you)` : m.email}</strong></Typography>
                      <Typography variant="small" color="subdued">{m.role === 'owner' ? 'Owner' : 'Member'}</Typography>
                    </Stack>
                  </div>
                  {members.length > 1 && (m.isMe || (isOwner && !m.isMe)) && (
                    <Button variant="secondary" size="small" disabled={busy} onClick={() => removeMember(m.userId, m.email, m.isMe)}>
                      {m.isMe ? 'Leave' : 'Remove'}
                    </Button>
                  )}
                </Stack>
              </Box>
            ))}
            {invites.map((i) => (
              <Box key={i.id} border="default" borderRadius="md" p="md">
                <Stack direction="row" gap="md" justifyContent="space-between" alignItems="center">
                  <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                    <Stack direction="column" gap="xs">
                      <Typography variant="body"><strong>{i.email}</strong></Typography>
                      <Box>
                        <Chip>{`Invited · until ${new Date(i.expiresAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`}</Chip>
                      </Box>
                    </Stack>
                  </div>
                  {isOwner && (
                    <Button variant="secondary" size="small" disabled={busy} onClick={() => cancelInvite(i.id, i.email)}>
                      Cancel
                    </Button>
                  )}
                </Stack>
              </Box>
            ))}
          </Stack>
        )}

        {data && isOwner && (
          atCap ? (
            <Typography variant="small" color="subdued">
              Your household is full. Cancel an invite or remove someone to invite another person.
            </Typography>
          ) : (
            <>
              <Stack direction="row">
                <Button
                  variant="secondary"
                  size="medium"
                  iconName="add"
                  onClick={() => {
                    setInviteEmail('');
                    setInviteOpen(true);
                  }}
                >
                  Invite someone
                </Button>
              </Stack>
              <Modal
                isOpen={inviteOpen}
                onClose={() => setInviteOpen(false)}
                title="Invite to your household"
                size="small"
                actions={[
                  { label: 'Cancel', onClick: () => setInviteOpen(false), variant: 'secondary' },
                  { label: 'Send invite', onClick: sendInvite, variant: 'primary', disabled: busy || !newEmail || !!emailError },
                ]}
              >
                <Stack direction="column" gap="md">
                  <TextField
                    label="Email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="partner@example.com"
                    error={emailError}
                  />
                  <Typography variant="small" color="subdued">
                    {`They'll get an email with a link that works for ${INVITE_DAYS} days. If they already use Meal Agent, joining replaces their own household.`}
                  </Typography>
                </Stack>
              </Modal>
            </>
          )
        )}
      </Stack>
    </SettingsSection>
  );
}
