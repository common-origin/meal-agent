"use client";

import { useEffect, useState } from "react";
import { Box, Button, Stack, Typography } from "@common-origin/design-system";
import SettingsSection from "./SettingsSection";

async function fetchToken(rotate: boolean): Promise<string> {
  const res = await fetch('/api/household/extension-token', { method: rotate ? 'POST' : 'GET' }).catch(() => null);
  const body = await res?.json().catch(() => ({}));
  if (!res?.ok || !body?.token) throw new Error(body?.error ?? (rotate ? 'Could not replace the token.' : 'Could not load the extension token.'));
  return body.token;
}

/**
 * Settings section for the Coles side-panel extension (#184): the token to
 * paste into the extension's options, and a way to replace it.
 */
export default function ColesExtensionSettings() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = (rotate: boolean) =>
    fetchToken(rotate).then(
      token => { setToken(token); setError(null); },
      (e: Error) => setError(e.message),
    );

  useEffect(() => {
    fetchToken(false).then(setToken, (e: Error) => setError(e.message));
  }, []);

  const copy = async () => {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
  };

  const replace = () => {
    if (window.confirm('Replace the token? The extension stops working until you paste the new one into its options.')) {
      setCopied(false);
      load(true);
    }
  };

  return (
    <SettingsSection
      title="Coles extension"
      description={
        <>
          Paste this token into the Meal Agent for Coles extension&apos;s options. It lets the extension read your
          approved shopping list and remember the products you buy. Treat it like a password.
        </>
      }
    >
      <Stack direction="column" gap="2xl">
        {token ? (
          <>
            {/* Laid out like the calendar link's card; Replace token sits outside it (#196) */}
            <Box border="default" borderRadius="md" p="md">
              <Stack direction="row" gap="md" justifyContent="space-between" alignItems="center">
                <div style={{ minWidth: 0 }}>
                  <Stack direction="column" gap="xs">
                    <Typography variant="body"><strong>Extension token</strong></Typography>
                    <Typography variant="small" color="subdued">{`${token.slice(0, 8)}…`}</Typography>
                  </Stack>
                </div>
                <Button variant="secondary" size="small" onClick={copy}>
                  {copied ? 'Copied' : 'Copy token'}
                </Button>
              </Stack>
            </Box>
            <Stack direction="row">
              <Button variant="secondary" size="medium" onClick={replace}>
                Replace token
              </Button>
            </Stack>
          </>
        ) : (
          !error && <Typography color="subdued">Loading your extension token…</Typography>
        )}
        {error && (
          <Typography color="error">
            {token ? `${error} The token above is still the current one.` : error}
          </Typography>
        )}
      </Stack>
    </SettingsSection>
  );
}
