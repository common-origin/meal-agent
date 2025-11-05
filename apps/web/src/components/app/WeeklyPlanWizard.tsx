"use client";

import { useState } from "react";
import { Stack, Typography, Button, Box, TextField } from "@common-origin/design-system";
import { CUISINE_OPTIONS } from "@/lib/types/settings";

interface WeeklyPlanWizardProps {
  onComplete: (data: WeeklyPlanData) => void;
  onCancel?: () => void;
}

export interface WeeklyPlanData {
  pantryItems: string[];
  cuisines: string[];
}

export default function WeeklyPlanWizard({ onComplete, onCancel }: WeeklyPlanWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [pantryItems, setPantryItems] = useState<string[]>([]);
  const [newPantryItem, setNewPantryItem] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);

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
      console.error('❌ Error scanning image:', error);
      setScanError(error instanceof Error ? error.message : 'Failed to scan image');
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
        <Box border="default" borderRadius="4" p="xl" bg="surface">
          <Stack direction="column" gap="md">
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h2">🥗 Step 1: Pantry Stocktake</Typography>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleScanPantryImage}
                style={{ display: 'none' }}
                id="pantry-image-upload-wizard"
              />
              <Button
                variant="secondary"
                size="small"
                onClick={() => document.getElementById('pantry-image-upload-wizard')?.click()}
                disabled={isScanning}
              >
                {isScanning ? '📸 Scanning...' : '📸 Scan Fridge/Pantry'}
              </Button>
            </Stack>

            <Typography variant="body">
              What ingredients do you already have at home that you want to use this week? Add them manually or scan your fridge/pantry.
            </Typography>

            {scanError && (
              <div style={{
                padding: "12px",
                backgroundColor: "#f8d7da",
                border: "1px solid #dc3545",
                borderRadius: "8px"
              }}>
                <Typography variant="small">
                  ❌ {scanError}
                </Typography>
              </div>
            )}

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
                size="medium"
                onClick={handleAddPantryItem}
                disabled={!newPantryItem.trim()}
              >
                Add Item
              </Button>
            </Stack>

            {pantryItems.length > 0 && (
              <Stack direction="column" gap="xs">
                <div style={{ fontWeight: 600, fontSize: '14px' }}>
                  Items in your pantry ({pantryItems.length}):
                </div>
                {pantryItems.map((item, idx) => (
                  <Box 
                    key={idx} 
                    p="sm"
                    bg="subtle"
                    borderRadius="2"
                  >
                    <Stack 
                      direction="row" 
                      justifyContent="space-between" 
                      alignItems="center"
                    >
                      <Typography variant="body">• {item}</Typography>
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => handleRemovePantryItem(idx)}
                      >
                        Remove
                      </Button>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}

            {pantryItems.length === 0 && (
              <div style={{ color: '#666', fontSize: '14px' }}>
                💡 No items added yet. Add ingredients above or skip this step if you don&apos;t want to specify pantry items this week.
              </div>
            )}
          </Stack>
        </Box>
      )}

      {/* Step 2: Cuisine Selection */}
      {currentStep === 2 && (
        <Box border="default" borderRadius="4" p="xl" bg="surface">
          <Stack direction="column" gap="md">
            <Typography variant="h2">🌍 Step 2: Cuisine Preferences</Typography>
            <Typography variant="body">
              What type of food would you like to eat this week? Select one or more cuisines.
            </Typography>

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
              <div style={{ color: '#dc3545', fontSize: '14px' }}>
                ⚠️ Please select at least one cuisine to continue
              </div>
            )}

            {selectedCuisines.length > 0 && (
              <div style={{ color: '#28a745', fontSize: '14px' }}>
                ✓ {selectedCuisines.length} cuisine{selectedCuisines.length > 1 ? 's' : ''} selected
              </div>
            )}
          </Stack>
        </Box>
      )}

      {/* Step 3: Ready to Generate */}
      {currentStep === 3 && (
        <Box border="default" borderRadius="4" p="xl" bg="surface">
          <Stack direction="column" gap="md" alignItems="center">
            <Typography variant="h2">✨ Step 3: Generate Your Meal Plan</Typography>
            <div style={{ textAlign: 'center', maxWidth: '600px' }}>
              <Typography variant="body">
                Great! We&apos;re ready to create your personalized weekly meal plan based on your preferences.
              </Typography>
            </div>

            <Box p="lg" bg="subtle" borderRadius="3" style={{ width: '100%', maxWidth: '600px' }}>
              <Stack direction="column" gap="sm">
                <div style={{ fontWeight: 600, fontSize: '14px' }}>
                  📋 Your Weekly Plan Summary:
                </div>
                <Typography variant="small">
                  • {pantryItems.length} pantry items to use
                </Typography>
                <Typography variant="small">
                  • {selectedCuisines.length} cuisine{selectedCuisines.length > 1 ? 's' : ''}: {selectedCuisines.join(', ')}
                </Typography>
              </Stack>
            </Box>

            <div style={{ color: '#666', textAlign: 'center', fontSize: '14px' }}>
              Click &quot;Generate Plan&quot; below to create your personalized weekly meal plan with AI
            </div>
          </Stack>
        </Box>
      )}

      {/* Navigation Buttons */}
      <Box mt="xl">
        <Stack direction="row" justifyContent="space-between">
          <Button
            variant="secondary"
            size="medium"
            onClick={handleBack}
            disabled={currentStep === 1}
          >
            ← Back
          </Button>

          <Stack direction="row" gap="md">
            {onCancel && (
              <Button
                variant="secondary"
                size="medium"
                onClick={onCancel}
              >
                Cancel
              </Button>
            )}
            
            <Button
              variant="primary"
              size="medium"
              onClick={handleNext}
              disabled={!canProceed()}
            >
              {currentStep === totalSteps ? '✨ Generate Plan' : 'Next →'}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}
