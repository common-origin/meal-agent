"use client";

import { useState } from "react";
import { Alert, BooleanChip, Divider, Stack, Typography, Button, Box, TextField, List, ListItem, IconButton, Chip } from "@common-origin/design-system";
import Main from "@/components/app/Main";
import ButtonGroup from "@/components/app/ButtonGroup";
import { CUISINE_OPTIONS, MAX_SETTING_TEXT_LENGTH } from "@/lib/types/settings";
import { apiErrorMessage, redirectToLoginIfUnauthenticated } from "@/lib/api/client";
import { imageUploadFormData, PhotoTooLargeError } from "@/lib/client/resizeImage";
import { addItem, isUseSoon, itemsToUseSoon, mergeScan, removeItem, toggleUseSoon, type PantryState } from "@/lib/pantryItems";

interface WeeklyPlanWizardProps {
  onComplete: (data: WeeklyPlanData) => void;
  onCancel?: () => void;
}

export interface WeeklyPlanData {
  pantryItems: string[];
  /** Pantry items flagged to use this week (#91). */
  useSoonItems: string[];
  cuisines: string[];
  preferredChef?: string;
}

export default function WeeklyPlanWizard({ onComplete, onCancel }: WeeklyPlanWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [pantry, setPantry] = useState<PantryState>({ items: [], useSoon: [] });
  const pantryItems = pantry.items;
  const [newPantryItem, setNewPantryItem] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [preferredChef, setPreferredChef] = useState('');

  const totalSteps = 3;

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
      const errorMessage = error instanceof Error ? error.message : 'Failed to scan image';
      setScanError(errorMessage);
    } finally {
      setIsScanning(false);
      // Clear the input even after an error, so picking the same photo again still fires onChange.
      event.target.value = '';
    }
  };

  const handleAddPantryItem = () => {
    if (newPantryItem.trim()) {
      setPantry((current) => addItem(current, newPantryItem));
      setNewPantryItem('');
    }
  };

  const handleRemovePantryItem = (index: number) => {
    setPantry((current) => removeItem(current, index));
  };

  const toggleCuisine = (cuisineId: string) => {
    setSelectedCuisines(prev => {
      if (prev.includes(cuisineId)) {
        return prev.filter(id => id !== cuisineId);
      } else {
        return [...prev, cuisineId];
      }
    });
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      // Complete wizard
      onComplete({
        pantryItems,
        useSoonItems: itemsToUseSoon(pantry),
        cuisines: selectedCuisines,
        preferredChef: preferredChef.trim() || undefined,
      });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceed = () => {
    if (currentStep === 1) return true; // Pantry is optional
    if (currentStep === 2) return selectedCuisines.length > 0;
    return true;
  };

  return (
    <Main maxWidth="md">
      <Box>
        {/* Progress Indicator */}
        <Box mb="xl">
          <Stack direction="row" gap="md" justifyContent="center" alignItems="center">
            {[1, 2, 3].map((step) => (
              <Stack key={step} direction="row" gap="sm" alignItems="center">
                <Box
                  p="sm"
                  bg={step === currentStep ? 'emphasis' : step < currentStep ? 'success' : 'subtle'}
                  borderRadius="circle"
                  style={{
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography variant="body" color={step === currentStep || step < currentStep ? 'inverse' : 'default'}>
                    {step < currentStep ? '✓' : step}
                  </Typography>
                </Box>
                <Typography variant="body">
                  {step === 1 ? 'Pantry' : step === 2 ? 'Cuisines' : 'Generate'}
                </Typography>
                {step < 3 && <Typography variant="body" color="subdued">→</Typography>}
              </Stack>
            ))}
          </Stack>
        </Box>

        {/* Step 1: Pantry Stocktake */}
        {currentStep === 1 && (
          <Box border="default" borderRadius="lg" p="xl" pb="9xl" bg="default">
            <Stack direction="column" gap="lg">
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h2">Step 1: Pantry stocktake</Typography>
              </Stack>

              <Typography variant="body">
                What ingredients do you already have at home that you want to use this week? Add them manually or scan your fridge/pantry.
              </Typography>

              {scanError && (
                <Alert variant="error" dismissible onDismiss={() => setScanError(null)}>
                  {scanError}
                </Alert>
              )}

              <Divider size="small"/>
              
              <Box>
                <Stack direction="column" gap="lg" alignItems="flex-start">
                  <Typography variant="h3">Smart scan</Typography>
                  <Typography variant="label">Scan an image of your pantry or fridge</Typography>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleScanPantryImage}
                    style={{ display: 'none' }}
                    id="pantry-image-upload-wizard"
                  />
                  <Button
                    variant="primary"
                    size="large"
                    iconName={isScanning ? undefined : 'export'}
                    onClick={() => document.getElementById('pantry-image-upload-wizard')?.click()}
                    disabled={isScanning}
                  >
                    {isScanning ? 'Scanning image...' : 'Upload image'}
                  </Button>
                </Stack>
              </Box>

              <Divider size="small"/>

              <Stack direction="column" gap="lg" alignItems="flex-start">
                <Typography variant="h3">Add an ingredient</Typography>
                <Stack direction="row" gap="sm" alignItems="flex-end">
                  <TextField
                    label="Add ingredient"
                    value={newPantryItem}
                    onChange={(e) => setNewPantryItem(e.target.value)}
                    placeholder="e.g., chicken breast, tomatoes, rice"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAddPantryItem();
                      }
                    }}
                    style={{ flex: 1 }}
                  />
                  <Button
                    variant="secondary"
                    size="large"
                    iconName="add"
                    onClick={handleAddPantryItem}
                    disabled={!newPantryItem.trim()}
                  >
                    Add item
                  </Button>
                </Stack>
              </Stack>

              {pantryItems.length > 0 && (
                <>
                  <Divider size="small"/>
                  <Stack direction="column" gap="lg">
                    <Typography variant="subtitle">Items in your pantry ({pantryItems.length})</Typography>
                    <Box p="none" border="default" bg="subtle">
                      <List dividers spacing="comfortable">
                        {pantryItems.map((item, idx) => (
                          <ListItem
                            key={idx}
                            primary={item}
                            badge={
                              <Stack direction="row" gap="sm" alignItems="center">
                                <BooleanChip
                                  size="small"
                                  selected={isUseSoon(pantry, item)}
                                  onClick={() => setPantry((current) => toggleUseSoon(current, item))}
                                  aria-label={`Use ${item} soon`}
                                >
                                  Use soon
                                </BooleanChip>
                                <IconButton
                                  variant="naked"
                                  iconName="trash"
                                  size="small"
                                  onClick={() => handleRemovePantryItem(idx)}
                                  aria-label={`Remove ${item}`}
                                />
                              </Stack>
                            }
                          />
                        ))}
                      </List>
                    </Box>
                  </Stack>
                </>
              )}

              {pantryItems.length === 0 && (
                <Alert variant="info" inline>
                  No items added yet. Add ingredients above or skip this step if you don&apos;t want to specify pantry items this week.
                </Alert>
              )}
            </Stack>
          </Box>
        )}

        {/* Step 2: Cuisine Selection */}
        {currentStep === 2 && (
          <Box border="default" borderRadius="lg" p="xl" pb="9xl" bg="default">
            <Stack direction="column" gap="lg">
              <Typography variant="h2">Step 2: Cuisine preferences</Typography>
              <Typography variant="body">
                What type of food would you like to eat this week? Select one or more cuisines.
              </Typography>

              <Divider size="small"/>

              <Typography variant="h3">Select cuisine</Typography>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '12px',
              }}>
                {CUISINE_OPTIONS.map((cuisine) => (
                  <button
                    key={cuisine.id}
                    onClick={() => toggleCuisine(cuisine.id)}
                    style={{
                      padding: '16px',
                      border: '1px solid #ccc',
                      borderRadius: '8px',
                      backgroundColor: selectedCuisines.includes(cuisine.id) ? '#007bff' : '#fff',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <Stack direction="column" gap="xs" alignItems="center">
                      <div style={{ fontSize: '32px' }}>
                        {cuisine.emoji}
                      </div>
                      <div 
                        style={{ 
                          fontWeight: selectedCuisines.includes(cuisine.id) ? 600 : 400,
                          fontSize: '14px',
                          color: selectedCuisines.includes(cuisine.id) ? '#fff' : 'inherit'
                        }}
                      >
                        {cuisine.label}
                      </div>
                    </Stack>
                  </button>
                ))}
              </div>

              {selectedCuisines.length === 0 && (
                <Alert variant="warning" inline>
                  Please select at least one cuisine to continue
                </Alert>
              )}

              {selectedCuisines.length > 0 && (
                <Alert variant="success" inline>
                  {selectedCuisines.length} cuisine{selectedCuisines.length > 1 ? 's' : ''} selected
                </Alert>
              )}

              <Divider size="small"/>

              <Typography variant="h3">Select inspiration</Typography>

              <Box>
                <TextField
                  label="Preferred Chef or Recipe Source (optional)"
                  value={preferredChef}
                  maxLength={MAX_SETTING_TEXT_LENGTH}
                  onChange={(e) => setPreferredChef(e.target.value)}
                  placeholder="e.g., Jamie Oliver, Ottolenghi, RecipeTin Eats"
                  helperText="The AI will try to match the style of recipes from your preferred chef or recipe source"
                />
              </Box>
            </Stack>
          </Box>
        )}

        {/* Step 3: Ready to Generate */}
        {currentStep === 3 && (
          <Box border="default" borderRadius="lg" p="xl" pb="9xl" bg="default">
            <Stack direction="column" gap="lg">
              <Typography variant="h2">Step 3: Generate your meal plan</Typography>
              <Typography variant="body">
                Great! We&apos;re ready to create your personalized weekly meal plan based on your preferences.
              </Typography>

              <Box p="lg" bg="subtle" borderRadius="md" border="default">
                <Stack direction="column" gap="sm">
                  <Typography variant="h3">
                    Your weekly plan summary:
                  </Typography>
                  <Stack direction="row" gap="md">
                    <Chip variant="emphasis">{pantryItems.length}</Chip>
                    <Typography> pantry items to use</Typography>
                  </Stack>
                  <Stack direction="row" gap="md">
                    <Chip variant="emphasis">{selectedCuisines.length}</Chip>
                    <Typography> cuisine{selectedCuisines.length > 1 ? 's' : ''}: {selectedCuisines.join(', ')}</Typography>
                  </Stack>
                </Stack>
              </Box>

              <Typography variant="small">
                Click &quot;Generate plan&quot; below to create your personalized weekly meal plan with AI
              </Typography>
            </Stack>
          </Box>
        )}

        {/* Navigation Buttons */}
        <Box mt="xl" mb="9xl">
          <ButtonGroup
            left={
              <Button
                variant="secondary"
                size="large"
                iconName="arrowLeft"
                onClick={handleBack}
                disabled={currentStep === 1}
              >
                Back
              </Button>
            }
            right={
              <>
                {onCancel && (
                  <Button
                    variant="secondary"
                    size="large"
                    onClick={onCancel}
                  >
                    Cancel
                  </Button>
                )}
                
                <Button
                  variant="primary"
                  size="large"
                  iconName="check"
                  onClick={handleNext}
                  disabled={!canProceed()}
                >
                  {currentStep === totalSteps ? 'Generate plan' : 'Next'}
                </Button>
              </>
            }
          />
        </Box>
      </Box>
    </Main>
  );
}
