"use client";

import { useEffect, useState } from "react";
import { Box, Button, Stack, Typography } from "@common-origin/design-system";
import SettingsSection from "./SettingsSection";

interface TokenState {
  token: string;
  /** Only the household owner can replace it (#217). */
  canReplace: boolean;
}

async function fetchToken(rotate: boolean): Promise<TokenState> {
  const res = await fetch('/api/household/extension-token', { method: rotate ? 'POST' : 'GET' }).catch(() => null);
  const body = await res?.json().catch(() => ({}));
  if (!res?.ok || !body?.token) throw new Error(body?.error ?? (rotate ? 'Could not replace the token.' : 'Could not load the extension token.'));
  return { token: body.token, canReplace: body.canReplace === true };
}

/** Built from apps/coles-extension by each deploy (#229); see its scripts/package.mjs. */
const EXTENSION_ZIP = '/coles-extension.zip';
const EXTENSION_INFO = '/coles-extension.json';

/** The version in the downloadable zip, or null (e.g. a dev server, which doesn't build it). */
async function fetchExtensionVersion(): Promise<string | null> {
  const res = await fetch(EXTENSION_INFO).catch(() => null);
  const body: unknown = res?.ok ? await res.json().catch(() => null) : null;
  return body && typeof body === 'object' && 'version' in body && typeof body.version === 'string' ? body.version : null;
}

const INSTALL_STEPS = [
  'Download the extension and unzip it. Keep the meal-agent-for-coles folder somewhere it won\u2019t be deleted: Chrome runs it from there.',
  'In Chrome, go to chrome://extensions and turn on Developer mode (top right).',
  'Click Load unpacked and choose the meal-agent-for-coles folder.',
  'Copy the token below, then right-click the extension\u2019s icon, choose Options, paste it and click Save.',
];

/**
 * Settings section for the Coles side-panel extension (#184): how to
 * install it (#229), the token to paste into its options, and a way to
 * replace the token.
 */
export default function ColesExtensionSettings() {
  const [state, setState] = useState<TokenState | null>(null);
  const token = state?.token ?? null;
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [version, setVersion] = useState<string | null>(null);

  const load = (rotate: boolean) =>
    fetchToken(rotate).then(
      next => { setState(next); setError(null); },
      (e: Error) => setError(e.message),
    );

  useEffect(() => {
    fetchToken(false).then(setState, (e: Error) => setError(e.message));
    void fetchExtensionVersion().then(setVersion);
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
          The Meal Agent for Coles extension puts your approved shopping list beside coles.com.au and fills your
          trolley from it. It works in Chrome on a computer (and Edge or Brave), not on phones.
        </>
      }
    >
      <Stack direction="column" gap="2xl">
        <Stack direction="column" gap="md">
          <Stack direction="column" gap="sm">
            {INSTALL_STEPS.map((step, i) => (
              <Typography key={step} variant="body">{`${i + 1}. ${step}`}</Typography>
            ))}
          </Stack>
          <Typography variant="small" color="subdued">
            Chrome may warn about developer mode extensions when it starts; that&apos;s expected for an extension
            installed this way. To update, download it again, replace the folder&apos;s contents and click the
            extension&apos;s reload button in chrome://extensions.
          </Typography>
          <Stack direction="row" gap="md" alignItems="center">
            <Button variant="secondary" size="medium" purpose="link" url={EXTENSION_ZIP} download iconName="download">
              Download the extension
            </Button>
            {version && <Typography variant="small" color="subdued">{`Version ${version}`}</Typography>}
          </Stack>
        </Stack>
        <Typography variant="body">
          The token lets the extension read your approved shopping list and remember the products you buy. Treat it
          like a password.
        </Typography>
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
            {state?.canReplace && (
              <Stack direction="row">
                <Button variant="secondary" size="medium" onClick={replace}>
                  Replace token
                </Button>
              </Stack>
            )}
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
