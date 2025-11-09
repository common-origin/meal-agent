"use client";

import { useState } from "react";
import styled from "styled-components";
import { Alert, Divider, Stack, Typography, Button, Box, TextField, List, ListItem, IconButton, Chip } from "@common-origin/design-system";
import { tokens } from "@common-origin/design-system";
import { CUISINE_OPTIONS } from "@/lib/types/settings";

interface WeeklyPlanWizardProps {
  onComplete: (data: WeeklyPlanData) => void;
  onCancel?: () => void;
}

const PageLayout = styled.div`
  max-width: ${tokens.base.breakpoint.md};
  margin: 0 auto;
`;

export interface WeeklyPlanData {
  pantryItems: string[];
  cuisines: string[];
  preferredChef?: string;
}

export default function WeeklyPlanWizard({ onComplete, onCancel }: WeeklyPlanWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [pantryItems, setPantryItems] = useState<string[]>([]);
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
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/scan-pantry-image', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        // Handle rate limit error specifically
        if (data.isRateLimit) {
          throw new Error('API rate limit reached. Please wait a few minutes and try again, or add ingredients manually.');
        }
        throw new Error(data.error || data.details || 'Failed to scan image');
      }

      const newIngredients = data.ingredients.filter(
        (item: string) => !pantryItems.some(existing => existing.toLowerCase() === item.toLowerCase())
      );

      if (newIngredients.length > 0) {
        setPantryItems([...pantryItems, ...newIngredients]);
      }

      event.target.value = '';
    } catch (error) {
      console.error('Error scanning image:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to scan image';
      setScanError(errorMessage);
    } finally {
      setIsScanning(false);
    }
  };

  const handleAddPantryItem = () => {
    if (newPantryItem.trim()) {
      setPantryItems([...pantryItems, newPantryItem.trim()]);
      setNewPantryItem('');
    }
  };

  const handleRemovePantryItem = (index: number) => {
    setPantryItems(items => items.filter((_, i) => i !== index));
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
    <PageLayout>
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
                  <div style={{ color: step <= currentStep ? '#fff' : '#666', fontSize: '12px' }}>
                    {step < currentStep ? '✓' : step}
                  </div>
                </Box>
                <div style={{ fontWeight: step === currentStep ? 600 : 400, fontSize: '14px' }}>
                  {step === 1 ? 'Pantry' : step === 2 ? 'Cuisines' : 'Generate'}
                </div>
                {step < 3 && <div style={{ color: '#ccc', fontSize: '14px' }}>→</div>}
              </Stack>
            ))}
          </Stack>
        </Box>

        {/* Step 1: Pantry Stocktake */}
        {currentStep === 1 && (
          <Box border="default" borderRadius="4" p="xl" pb="9xl" bg="default">
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
                              <IconButton
                                variant="naked"
                                iconName="trash"
                                size="small"
                                onClick={() => handleRemovePantryItem(idx)}
                                aria-label={`Remove ${item}`}
                              />
                            }
                          />
                        ))}
                      </List>
                    </Box>
                  </Stack>
                </>
              )}

              {pantryItems.length === 0 && (
                <div style={{ color: '#666', fontSize: '14px' }}>
                  No items added yet. Add ingredients above or skip this step if you don&apos;t want to specify pantry items this week.
                </div>
              )}
            </Stack>
          </Box>
        )}

        {/* Step 2: Cuisine Selection */}
        {currentStep === 2 && (
          <Box border="default" borderRadius="4" p="xl" pb="9xl" bg="default">
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
          <Box border="default" borderRadius="4" p="xl" pb="9xl" bg="default">
            <Stack direction="column" gap="lg">
              <Typography variant="h2">Step 3: Generate your meal plan</Typography>
              <Typography variant="body">
                Great! We&apos;re ready to create your personalized weekly meal plan based on your preferences.
              </Typography>

              <Box p="lg" bg="subtle" borderRadius="3" border="default">
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
                Click &quot;Generate Plan&quot; below to create your personalized weekly meal plan with AI
              </Typography>
            </Stack>
          </Box>
        )}

        {/* Navigation Buttons */}
        <Box mt="xl" mb="9xl">
          <Stack direction="row" justifyContent="space-between">
            <Button
              variant="secondary"
              size="large"
              iconName="arrowLeft"
              onClick={handleBack}
              disabled={currentStep === 1}
            >
              Back
            </Button>

            <Stack direction="row" gap="md">
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
            </Stack>
          </Stack>
        </Box>
      </Box>
    </PageLayout>
  );
}
