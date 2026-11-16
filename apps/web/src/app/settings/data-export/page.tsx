'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Container, Modal, Stack, TextField, Typography } from '@common-origin/design-system';
import Main from '@/components/app/Main';
import SettingsSection, { SettingsForm } from '@/components/app/SettingsSection';
import { useAuth } from '@/components/auth/AuthProvider';
import { createClient } from '@/lib/supabase/client';
import * as LocalStorage from '@/lib/storage';
import { loadPantryPreferences } from '@/lib/pantryPreferences';
import { deleteConfirmation } from '@/lib/account/deleteConfirmation';

/** What only this browser keeps: added to the household's data from Supabase. */
function thisBrowsersData() {
  return {
    recipeRatings: LocalStorage.getRecipeRatings(),
    blockedRecipes: Array.from(LocalStorage.getBlockedRecipes()),
    pantryPreferences: Array.from(loadPantryPreferences()),
    cachedSettings: LocalStorage.loadFamilySettings(),
  };
}

function download(filename: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Settings → Your data (#224): download everything, or delete the account.
 * The household's data comes from /api/account/export; deletion goes
 * through /api/account/delete (migration 017's delete_my_account()).
 */
export default function YourDataPage() {
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ variant: 'success' | 'error'; text: string } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const exportData = async () => {
    setExporting(true);
    setExportResult(null);
    try {
      const res = await fetch('/api/account/export');
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Your data couldn't be exported. Please try again.");
      download(`meal-agent-data-${new Date().toISOString().slice(0, 10)}.json`, { ...body, thisBrowser: thisBrowsersData() });
      setExportResult({ variant: 'success', text: 'Downloaded. Check your downloads folder.' });
    } catch (e) {
      setExportResult({ variant: 'error', text: e instanceof Error ? e.message : "Your data couldn't be exported. Please try again." });
    } finally {
      setExporting(false);
    }
  };

  const confirmation = deleteConfirmation(user?.email);
  const emailMatches = !!user && confirmEmail.trim().toLowerCase() === confirmation.toLowerCase();

  const deleteAccount = async () => {
    if (!emailMatches) return;
    setDeleting(true);
    setDeleteError(null);
    const res = await fetch('/api/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmEmail }),
    }).catch(() => null);
    const body = await res?.json().catch(() => ({}));
    if (!res?.ok) {
      setDeleteError(body?.error ?? "Your account couldn't be deleted. Please try again.");
      setDeleting(false);
      return;
    }
    // The account is gone: drop this browser's session (locally; there's no
    // user left to sign out on the server) and everything it cached.
    await createClient().auth.signOut({ scope: 'local' }).catch(() => {});
    LocalStorage.clearHouseholdScopedCaches();
    window.location.assign('/');
  };

  return (
    <Main maxWidth="960px">
      <Container>
        <Stack direction="column" gap="xl">
          <Stack direction="column" gap="sm">
            <Typography variant="h1">Your data</Typography>
            <Typography variant="body">
              Download everything Meal Agent keeps about your household, or delete your account. See the{' '}
              <Link href="/privacy">privacy policy</Link> for what&apos;s stored and why.
            </Typography>
          </Stack>

          <SettingsForm>
            <SettingsSection
              title="Export your data"
              description="A JSON file of your household's settings, recipes, meal plans, shopping lists, pantry, favourites, Coles orders and members, plus what this browser keeps (ratings and blocked recipes)."
            >
              <Stack direction="column" gap="md">
                {exportResult && (
                  <Alert variant={exportResult.variant} appearance="borderless" dismissible onDismiss={() => setExportResult(null)}>
                    {exportResult.text}
                  </Alert>
                )}
                <Stack direction="row">
                  <Button variant="secondary" size="medium" iconName="download" onClick={exportData} disabled={exporting}>
                    {exporting ? 'Preparing…' : 'Download my data'}
                  </Button>
                </Stack>
              </Stack>
            </SettingsSection>

            <SettingsSection
              title="Delete your account"
              description="Deletes your account and sign-in. If you're the only person in your household, its plans, recipes, shopping lists, settings and Coles data are deleted too. Otherwise the household stays with its other members. This can't be undone."
            >
              <Stack direction="row">
                <Button
                  variant="danger"
                  size="medium"
                  onClick={() => {
                    setConfirmEmail('');
                    setDeleteError(null);
                    setDeleteOpen(true);
                  }}
                >
                  Delete my account
                </Button>
              </Stack>
            </SettingsSection>
          </SettingsForm>

          <Modal
            isOpen={deleteOpen}
            onClose={() => !deleting && setDeleteOpen(false)}
            title="Delete your account?"
            size="small"
            actions={[
              { label: 'Cancel', onClick: () => setDeleteOpen(false), variant: 'secondary', disabled: deleting },
              { label: deleting ? 'Deleting…' : 'Delete account', onClick: deleteAccount, variant: 'danger', disabled: deleting || !emailMatches },
            ]}
          >
            <Stack direction="column" gap="md">
              <Typography variant="body">
                This deletes your account straight away and can&apos;t be undone. Download your data first if you want a copy.
              </Typography>
              {deleteError && <Alert variant="error" appearance="borderless">{deleteError}</Alert>}
              <TextField
                label={user?.email ? 'Type your email to confirm' : 'Type DELETE to confirm'}
                type={user?.email ? 'email' : 'text'}
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={confirmation}
                disabled={deleting}
              />
            </Stack>
          </Modal>
        </Stack>
      </Container>
    </Main>
  );
}
