"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Dropdown, FilterChip, InlineAlert, Stack, TextField, Typography } from "@common-origin/design-system";
import Main from "@/components/app/Main";
import ButtonGroup from "@/components/app/ButtonGroup";
import PantrySheet from "@/components/app/PantrySheet";
import { CUISINE_OPTIONS, MAX_SETTING_TEXT_LENGTH } from "@/lib/types/settings";
import { apiErrorMessage, redirectToLoginIfUnauthenticated } from "@/lib/api/client";
import { imageUploadFormData, PhotoTooLargeError } from "@/lib/client/resizeImage";
import { itemsToUseSoon, mergeScan, pantrySummary, type PantryState } from "@/lib/pantryItems";
import { formatWeekRange, planningWeekOptions, relativeWeekLabel } from "@/lib/schedule";
import { getFamilySettings, loadPantryItems } from "@/lib/hybridStorage";

interface WeeklyPlanWizardProps {
  onComplete: (data: WeeklyPlanData) => void;
  onCancel?: () => void;
  /** The Monday of the week selected to start with (#194). */
  initialWeek: string;
  /** Weeks that already have a plan, so choosing one can say it will be replaced. */
  plannedWeeks: string[];
}

export interface WeeklyPlanData {
  /** The Monday of the week this plan is for (#194). */
  weekStart: string;
  /** The nights to plan, 0 = Monday to 6 = Sunday (#195); the others stay empty. */
  nights: number[];
  pantryItems: string[];
  /** Pantry items flagged to use this week (#91). */
  useSoonItems: string[];
  cuisines: string[];
  preferredChef?: string;
}

const NIGHTS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ALL_NIGHTS = [0, 1, 2, 3, 4, 5, 6];

/** "This week · Mon 9 – Sun 15 Nov", or just the dates further out. */
function weekOptionLabel(week: string): string {
  const relative = relativeWeekLabel(week);
  return relative ? `${relative} · ${formatWeekRange(week)}` : formatWeekRange(week);
}

/** A labelled group on the planner, in the field label style. */
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <Stack direction="column" gap="sm">
      <Typography variant="label">{label}</Typography>
      {children}
      {hint && <Typography variant="small" color="subdued">{hint}</Typography>}
    </Stack>
  );
}

/**
 * Plan your week (#195): one screen, ready to generate as soon as it opens.
 * The pantry comes from the household's saved list and the cuisines and chef
 * from Settings, so every choice here is optional.
 */
export default function WeeklyPlanWizard({ onComplete, onCancel, initialWeek, plannedWeeks }: WeeklyPlanWizardProps) {
  const [weekStart, setWeekStart] = useState(initialWeek);
  const weekOptions = planningWeekOptions(initialWeek);
  const replacesPlan = plannedWeeks.includes(weekStart);
  const [nights, setNights] = useState<number[]>(ALL_NIGHTS);
  const [pantry, setPantry] = useState<PantryState>({ items: [], useSoon: [] });
  const [showPantry, setShowPantry] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [preferredChef, setPreferredChef] = useState('');
  const [showMore, setShowMore] = useState(false);
  // Until Settings and the saved pantry load, so Generate doesn't run on empty defaults
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getFamilySettings(), loadPantryItems().catch(() => [] as string[])]).then(([settings, savedPantry]) => {
      if (cancelled) return;
      // "Use soon" is per week, so it starts empty (#91)
      setPantry({ items: savedPantry, useSoon: [] });
      setSelectedCuisines(settings.cuisines.filter((id) => CUISINE_OPTIONS.some((option) => option.id === id)));
      setPreferredChef(settings.preferredChef ?? '');
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleScanPantryImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanError(null);

    try {
      // Resized on the client to stay well under Vercel's 4.5 MB body limit (#82).
      const formData = await imageUploadFormData(file);

      const response = await fetch('/api/scan-pantry-image', {
        method: 'POST',
        body: formData,
      });

      if (redirectToLoginIfUnauthenticated(response)) return;
      // Vercel's 413 body isn't our JSON, so handle it before parsing.
      if (response.status === 413) throw new PhotoTooLargeError();

      const data = await response.json().catch(() => null);

      if (!response.ok || !data || data.error) {
        throw new Error(apiErrorMessage(data));
      }

      setPantry((current) => mergeScan(current, data.items));
    } catch (error) {
      console.error('Error scanning image:', error);
      setScanError(error instanceof Error ? error.message : 'Failed to scan image');
    } finally {
      setIsScanning(false);
      // Clear the input even after an error, so picking the same photo again still fires onChange.
      event.target.value = '';
    }
  };

  const toggleNight = (night: number) =>
    setNights((current) => (current.includes(night) ? current.filter((n) => n !== night) : [...current, night].sort()));

  const toggleCuisine = (cuisineId: string) =>
    setSelectedCuisines((current) =>
      current.includes(cuisineId) ? current.filter((id) => id !== cuisineId) : [...current, cuisineId]
    );

  const canGenerate = loaded && nights.length > 0;

  const handleGenerate = () => {
    if (!canGenerate) return;
    onComplete({
      weekStart,
      nights,
      pantryItems: pantry.items,
      useSoonItems: itemsToUseSoon(pantry),
      // None selected: the plan page falls back to Settings' cuisines
      cuisines: selectedCuisines,
      preferredChef: preferredChef.trim() || undefined,
    });
  };

  return (
    <Main maxWidth="md">
      <Stack direction="column" gap="xl">
        <Stack direction="column" gap="xs">
          <Typography variant="h1">Plan your week</Typography>
          <Typography variant="body" color="subdued">
            Everything here is optional. Generate when you&apos;re ready.
          </Typography>
        </Stack>

        <Box borderRadius="lg" p="xl" bg="surface.raised">
          <Stack direction="column" gap="2xl">
            <Stack direction="column" gap="sm">
              <Box maxWidth="540px" style={{ width: '100%' }}>
                <Dropdown
                  label="Week"
                  options={weekOptions.map((week) => ({ id: week, label: weekOptionLabel(week) }))}
                  value={weekStart}
                  onChange={setWeekStart}
                />
              </Box>
              {replacesPlan && (
                <InlineAlert variant="warning">
                  This week already has a plan. Generating will replace it.
                </InlineAlert>
              )}
            </Stack>

            <Field
              label="Nights"
              hint={
                nights.length === 0
                  ? undefined
                  : `${nights.length} ${nights.length === 1 ? 'night' : 'nights'}. Switch off any you won't be cooking.`
              }
            >
              <Stack direction="row" gap="sm" wrap>
                {NIGHTS.map((name, night) => (
                  <FilterChip key={name} selected={nights.includes(night)} onClick={() => toggleNight(night)}>
                    {name}
                  </FilterChip>
                ))}
              </Stack>
              {nights.length === 0 && <InlineAlert variant="warning">Choose at least one night to plan.</InlineAlert>}
            </Field>

            <Field label="Pantry" hint="What you already have, so the plan uses it up.">
              <Stack direction="row" gap="md" alignItems="center" justifyContent="space-between" wrap>
                <Typography variant="body">{loaded ? pantrySummary(pantry) : 'Loading your pantry…'}</Typography>
                <Stack direction="row" gap="sm">
                  <Button variant="secondary" size="small" onClick={() => setShowPantry(true)} disabled={!loaded}>
                    Edit
                  </Button>
                  <input
                    ref={scanInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleScanPantryImage}
                    style={{ display: 'none' }}
                    aria-label="Scan a photo of your pantry or fridge"
                  />
                  <Button
                    variant="secondary"
                    size="small"
                    iconName={isScanning ? undefined : 'export'}
                    onClick={() => scanInputRef.current?.click()}
                    disabled={!loaded || isScanning}
                  >
                    {isScanning ? 'Scanning…' : 'Scan'}
                  </Button>
                </Stack>
              </Stack>
              {scanError && (
                <Alert variant="error" dismissible onDismiss={() => setScanError(null)}>
                  {scanError}
                </Alert>
              )}
            </Field>

            <Field label="Cuisines" hint="Pre-selected from your Settings. With none selected, your Settings are used.">
              <Stack direction="row" gap="sm" wrap>
                {CUISINE_OPTIONS.map((cuisine) => (
                  <FilterChip
                    key={cuisine.id}
                    selected={selectedCuisines.includes(cuisine.id)}
                    onClick={() => toggleCuisine(cuisine.id)}
                  >
                    {`${cuisine.emoji} ${cuisine.label}`}
                  </FilterChip>
                ))}
              </Stack>
            </Field>

            <Stack direction="column" gap="md">
              <Stack direction="row">
                <Button
                  variant="naked"
                  size="small"
                  iconName={showMore ? 'arrowUp' : 'arrowDown'}
                  onClick={() => setShowMore((open) => !open)}
                  aria-expanded={showMore}
                >
                  More options
                </Button>
              </Stack>
              {showMore && (
                <Box maxWidth="540px" style={{ width: '100%' }}>
                  <TextField
                    label="Preferred chef or recipe source"
                    value={preferredChef}
                    maxLength={MAX_SETTING_TEXT_LENGTH}
                    onChange={(e) => setPreferredChef(e.target.value)}
                    placeholder="e.g., Jamie Oliver, Ottolenghi, RecipeTin Eats"
                    helperText="Recipes will match this style. Pre-filled from your Settings."
                  />
                </Box>
              )}
            </Stack>
          </Stack>
        </Box>

        <Box mb="9xl">
          <ButtonGroup
            left={
              onCancel ? (
                <Button variant="secondary" size="large" onClick={onCancel}>
                  Cancel
                </Button>
              ) : null
            }
            right={
              <Button variant="primary" size="large" iconName="check" onClick={handleGenerate} disabled={!canGenerate}>
                Generate plan
              </Button>
            }
          />
        </Box>
      </Stack>

      <PantrySheet
        isOpen={showPantry}
        onClose={() => setShowPantry(false)}
        pantry={pantry}
        onUpdatePantry={setPantry}
        onScanImage={handleScanPantryImage}
        isScanning={isScanning}
        scanError={scanError}
      />
    </Main>
  );
}
