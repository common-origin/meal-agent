"use client";

import { useState, useEffect } from "react";
import { Box, Button, Stack, Typography, Alert } from "@common-origin/design-system";
import Main from "@/components/app/Main";
import { getFamilySettings } from "@/lib/storage";
import type { FamilySettings } from "@/lib/types/settings";

interface TestResult {
  success: boolean;
  error?: string;
  message?: string;
  warning?: boolean;
  step?: string;
  canCreate?: boolean;
  recipeCount?: number;
  hasRecipeFile?: boolean;
  details?: {
    username?: string;
    repoName?: string;
    isPrivate?: boolean;
    recipes?: Array<{ id: string; title: string }>;
  };
}

export default function TestGitHubPage() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [settings, setSettings] = useState<FamilySettings | null>(null);

  useEffect(() => {
    const currentSettings = getFamilySettings();
    setSettings(currentSettings);
  }, []);

  const runTest = async () => {
    if (!settings?.github?.enabled) {
      setResult({
        success: false,
        error: 'GitHub sync is not enabled in Settings',
        step: 'config'
      });
      return;
    }

    if (!settings.github.token || !settings.github.owner || !settings.github.repo) {
      setResult({
        success: false,
        error: 'GitHub configuration is incomplete. Please fill in token, owner, and repo in Settings.',
        step: 'config'
      });
      return;
    }

    setTesting(true);
    setResult(null);

    try {
      const response = await fetch('/api/test-github-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: settings.github.token,
          owner: settings.github.owner,
          repo: settings.github.repo,
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
        step: 'network'
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Main maxWidth="md">
      <Stack direction="column" gap="xl">
        <Typography variant="h1">GitHub Connection Test</Typography>

        <Box border="subtle" borderRadius="4" p="lg" bg="default">
          <Stack direction="column" gap="md">
            <Typography variant="h3">Current Settings</Typography>
            
            {settings?.github?.enabled ? (
              <>
                <Typography variant="small">
                  <strong>Enabled:</strong> ✅ Yes
                </Typography>
                <Typography variant="small">
                  <strong>Username:</strong> {settings.github.owner || '(not set)'}
                </Typography>
                <Typography variant="small">
                  <strong>Repository:</strong> {settings.github.repo || '(not set)'}
                </Typography>
                <Typography variant="small">
                  <strong>Token:</strong> {settings.github.token ? `${settings.github.token.substring(0, 10)}...` : '(not set)'}
                </Typography>
                <Typography variant="small">
                  <strong>Auto-sync:</strong> {settings.github.autoSync ? '✅ Enabled' : '❌ Disabled'}
                </Typography>
                {settings.github.lastSynced && (
                  <Typography variant="small">
                    <strong>Last synced:</strong> {new Date(settings.github.lastSynced).toLocaleString()}
                  </Typography>
                )}
              </>
            ) : (
              <Typography variant="body" color="subdued">
                GitHub sync is not enabled. Enable it in Settings.
              </Typography>
            )}
          </Stack>
        </Box>

        <Button
          variant="primary"
          size="large"
          onClick={runTest}
          disabled={testing || !settings?.github?.enabled}
        >
          {testing ? 'Testing connection...' : 'Test GitHub Connection'}
        </Button>

        {result && (
          <Box border="subtle" borderRadius="4" p="lg" bg={result.success ? "success" : "error"}>
            <Stack direction="column" gap="md">
              <Typography variant="h3">
                {result.success ? '✅ Test Results' : '❌ Test Failed'}
              </Typography>

              {result.message && (
                <Alert variant={result.warning ? "warning" : result.success ? "success" : "error"} inline>
                  {result.message}
                </Alert>
              )}

              {result.error && (
                <Typography variant="body" color="error">
                  <strong>Error:</strong> {result.error}
                </Typography>
              )}

              {result.details && (
                <Box border="subtle" borderRadius="4" p="md" bg="surface">
                  <Stack direction="column" gap="sm">
                    <Typography variant="small">
                      <strong>GitHub Details:</strong>
                    </Typography>
                    {result.details.username && (
                      <Typography variant="small">
                        • Username: {result.details.username}
                      </Typography>
                    )}
                    {result.details.repoName && (
                      <Typography variant="small">
                        • Repository: {result.details.repoName}
                      </Typography>
                    )}
                    {result.details.isPrivate !== undefined && (
                      <Typography variant="small">
                        • Visibility: {result.details.isPrivate ? 'Private 🔒' : 'Public 🌍'}
                      </Typography>
                    )}
                    {result.recipeCount !== undefined && (
                      <Typography variant="small">
                        • Recipes in GitHub: {result.recipeCount}
                      </Typography>
                    )}
                    {result.hasRecipeFile !== undefined && (
                      <Typography variant="small">
                        • Recipe file exists: {result.hasRecipeFile ? '✅ Yes' : '❌ No (will be created)'}
                      </Typography>
                    )}
                  </Stack>
                </Box>
              )}

              {result.details?.recipes && result.details.recipes.length > 0 && (
                <Box border="subtle" borderRadius="4" p="md" bg="surface">
                  <Stack direction="column" gap="sm">
                    <Typography variant="small">
                      <strong>Recipes found:</strong>
                    </Typography>
                    {result.details.recipes.slice(0, 10).map((recipe: { id: string; title: string }) => (
                      <Typography key={recipe.id} variant="small">
                        • {recipe.title}
                      </Typography>
                    ))}
                    {result.details.recipes.length > 10 && (
                      <Typography variant="small" color="subdued">
                        ... and {result.details.recipes.length - 10} more
                      </Typography>
                    )}
                  </Stack>
                </Box>
              )}

              {result.step && (
                <Typography variant="small" color="subdued">
                  Failed at step: {result.step}
                </Typography>
              )}

              {result.canCreate && (
                <Typography variant="small" color="subdued">
                  💡 You can create the repository from the Settings page.
                </Typography>
              )}
            </Stack>
          </Box>
        )}
      </Stack>
    </Main>
  );
}
