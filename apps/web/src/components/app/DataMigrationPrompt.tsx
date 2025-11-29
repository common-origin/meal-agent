"use client";

import { useState, useEffect } from 'react';
import { Alert, Button, Stack, Typography } from '@common-origin/design-system';
import { migrateToSupabase } from '@/lib/storageAsync';
import { loadFamilySettings, loadCurrentWeekPlan } from '@/lib/storage';
import { getCurrentUser } from '@/lib/supabase/client';

/**
 * DataMigrationPrompt
 * 
 * Shows a prompt to authenticated users who have localStorage data,
 * offering to migrate their data to Supabase for multi-device access
 * and proper data isolation.
 */
export default function DataMigrationPrompt() {
  const [show, setShow] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    checkForMigration();
  }, []);

  async function checkForMigration() {
    try {
      // Check if user is authenticated
      const user = await getCurrentUser();
      if (!user) return;

      // Check if migration has already been completed
      const migrationFlag = localStorage.getItem('meal-agent:migration:completed');
      if (migrationFlag) return;

      // Check if user has any localStorage data to migrate
      const hasData = checkForLocalStorageData();
      if (hasData) {
        setShow(true);
      }
    } catch (error) {
      console.error('Error checking for migration:', error);
    }
  }

  function checkForLocalStorageData(): boolean {
    // Check for family settings
    const familySettings = loadFamilySettings();
    if (familySettings) return true;

    // Check for current week plan
    try {
      const weekPlan = loadCurrentWeekPlan(''); // Will return null if no match, but still checks existence
      if (weekPlan) return true;
    } catch {
      // Ignore errors
    }

    // Check for household data
    const household = localStorage.getItem('ma_household');
    if (household) return true;

    return false;
  }

  async function handleMigrate() {
    try {
      setMigrating(true);
      setError(null);

      const result = await migrateToSupabase();

      if (result.success) {
        setSuccess(true);
        // Mark migration as completed
        localStorage.setItem('meal-agent:migration:completed', 'true');
        
        // Hide prompt after 3 seconds
        setTimeout(() => {
          setShow(false);
        }, 3000);
      } else {
        setError(`Migration failed: ${result.errors.join(', ')}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration failed');
    } finally {
      setMigrating(false);
    }
  }

  function handleSkip() {
    // Mark as completed so we don't ask again
    localStorage.setItem('meal-agent:migration:completed', 'true');
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        maxWidth: 400,
        zIndex: 1000,
      }}
    >
      <Alert variant={success ? 'success' : error ? 'error' : 'info'}>
        <Stack gap="md">
          {success ? (
            <>
              <Typography variant="h6">Migration Complete!</Typography>
              <Typography variant="body">
                Your data has been successfully migrated to your account.
              </Typography>
            </>
          ) : error ? (
            <>
              <Typography variant="h6">Migration Failed</Typography>
              <Typography variant="body">{error}</Typography>
              <Button
                size="small"
                onClick={handleMigrate}
                disabled={migrating}
              >
                Try Again
              </Button>
            </>
          ) : (
            <>
              <Typography variant="h6">Migrate Your Data?</Typography>
              <Typography variant="body">
                We found existing meal plans and settings on this device. 
                Would you like to migrate them to your account for multi-device access?
              </Typography>
              <Stack direction="row" gap="sm">
                <Button
                  size="small"
                  onClick={handleMigrate}
                  disabled={migrating}
                >
                  {migrating ? 'Migrating...' : 'Migrate Now'}
                </Button>
                <Button
                  size="small"
                  variant="secondary"
                  onClick={handleSkip}
                  disabled={migrating}
                >
                  Skip
                </Button>
              </Stack>
            </>
          )}
        </Stack>
      </Alert>
    </div>
  );
}
