'use client';

import { useState } from 'react';
import { Box, Stack, Typography, Button, Alert } from '@common-origin/design-system';
import * as LocalStorage from '@/lib/storage';
import { loadPantryPreferences } from '@/lib/pantryPreferences';

export default function DataExportPage() {
  const [exported, setExported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportData = () => {
    try {
      // Gather all localStorage data
      const data = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        familySettings: LocalStorage.loadFamilySettings(),
        household: LocalStorage.loadHousehold(),
        pantryPreferences: Array.from(loadPantryPreferences()),
        recipeRatings: LocalStorage.getRecipeRatings(),
        blockedRecipes: Array.from(LocalStorage.getBlockedRecipes()),
        // Note: Recipes are stored in a separate RecipeLibrary system
        // and would need special handling
      };

      // Create download link
      const dataStr = JSON.stringify(data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `meal-agent-data-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      
      URL.revokeObjectURL(url);
      setExported(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export data');
      console.error('Export error:', err);
    }
  };

  const clearData = () => {
    if (!confirm('Are you sure you want to clear all local data? This cannot be undone!')) {
      return;
    }

    try {
      LocalStorage.Storage.clear();
      setError(null);
      alert('All local data cleared successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear data');
      console.error('Clear error:', err);
    }
  };

  return (
    <Box p="2xl" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <Stack direction="column" gap="xl">
        <Stack direction="column" gap="sm">
          <Typography variant="h1">Data Export & Management</Typography>
          <Typography color="subdued">
            Export your meal planning data as a backup or to transfer to another device.
          </Typography>
        </Stack>

        {error && (
          <Alert variant="error">
            <Typography>{error}</Typography>
          </Alert>
        )}

        {exported && (
          <Alert variant="success">
            <Typography>
              Data exported successfully! Check your downloads folder.
            </Typography>
          </Alert>
        )}

        <Box
          bg="subtle"
          p="xl"
          borderRadius="3"
          style={{ border: '1px solid #e0e0e0' }}
        >
          <Stack direction="column" gap="lg">
            <Stack direction="column" gap="sm">
              <Typography variant="h3">Export Your Data</Typography>
              <Typography color="subdued">
                Download a JSON file containing all your family settings, pantry preferences,
                recipe ratings, and other saved data.
              </Typography>
            </Stack>

            <Button onClick={exportData} style={{ alignSelf: 'flex-start' }}>
              Export Data as JSON
            </Button>
          </Stack>
        </Box>

        <Box
          bg="subtle"
          p="xl"
          borderRadius="3"
          style={{ border: '1px solid #fdd' }}
        >
          <Stack direction="column" gap="lg">
            <Stack direction="column" gap="sm">
              <Typography variant="h3">Clear Local Data</Typography>
              <Typography color="subdued">
                Warning: This will permanently delete all locally stored data including meal plans,
                family settings, and preferences. Make sure you&apos;ve exported your data first!
              </Typography>
            </Stack>

            <Button variant="secondary" onClick={clearData} style={{ alignSelf: 'flex-start' }}>
              Clear All Local Data
            </Button>
          </Stack>
        </Box>

        <Box
          bg="subtle"
          p="xl"
          borderRadius="3"
          style={{ border: '1px solid #e7f3ff' }}
        >
          <Stack direction="column" gap="md">
            <Typography variant="h3">About Your Data</Typography>
            <Stack direction="column" gap="sm">
              <Typography>
                <strong>Currently Stored Locally:</strong>
              </Typography>
              <Typography color="subdued">
                • Family settings (servings, dietary preferences)
                <br />
                • Pantry preferences (items you always have)
                <br />
                • Recipe ratings and blocked recipes
                <br />
                • Current week meal plan
                <br />
                • Household information
              </Typography>
            </Stack>

            <Stack direction="column" gap="sm">
              <Typography>
                <strong>Future: Cloud Sync</strong>
              </Typography>
              <Typography color="subdued">
                Once you sign in with an account, your data will be automatically synced to the cloud
                and accessible across all your devices.
              </Typography>
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
