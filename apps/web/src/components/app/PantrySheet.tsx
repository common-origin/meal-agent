"use client";

import { useState } from "react";
import { Stack, Typography, IconButton, Box, TextField, Sheet, Button, BooleanChip } from "@common-origin/design-system";
import { addItem, isUseSoon, removeItem, toggleUseSoon, type PantryState } from "@/lib/pantryItems";

interface PantrySheetProps {
  isOpen: boolean;
  onClose: () => void;
  pantry: PantryState;
  onUpdatePantry: (pantry: PantryState) => void;
  onScanImage: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isScanning: boolean;
  scanError: string | null;
}

export default function PantrySheet({
  isOpen,
  onClose,
  pantry,
  onUpdatePantry,
  onScanImage,
  isScanning,
  scanError
}: PantrySheetProps) {
  const [newItem, setNewItem] = useState('');

  const handleAddItem = () => {
    if (newItem.trim()) {
      onUpdatePantry(addItem(pantry, newItem));
      setNewItem('');
    }
  };

  const handleRemoveItem = (index: number) => {
    onUpdatePantry(removeItem(pantry, index));
  };

  const pantryItems = pantry.items;

  if (!isOpen) return null;

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      position="right"
      width="500px"
      title="Pantry/Fridge Items"
    >
      <Stack direction="column" gap="xl">
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h2">Pantry/Fridge Items</Typography>
          <IconButton
            variant="naked"
            iconName="close"
            size="medium"
            onClick={onClose}
            aria-label="Close pantry sheet"
          />
        </Stack>

        <Typography variant="body">
          Manage the ingredients you already have for this week. The AI will prioritize recipes using these items to reduce waste and save money. Mark anything that needs using soon and it will be used first.
        </Typography>

        {/* Scan Photo Section */}
        <Box border="default" borderRadius="lg" p="md" bg="subtle">
          <Stack direction="column" gap="md">
            <Typography variant="h3">Scan your fridge or pantry</Typography>
            <Typography variant="small">
              Take a photo to automatically detect ingredients
            </Typography>
            
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onScanImage}
              style={{ display: 'none' }}
              id="pantry-sheet-image-upload"
            />
            
            <Button
              variant="primary"
              size="medium"
              onClick={() => document.getElementById('pantry-sheet-image-upload')?.click()}
              disabled={isScanning}
            >
              {isScanning ? '📸 Scanning...' : 'Scan Photo'}
            </Button>

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
          </Stack>
        </Box>

        {/* Manual Entry Section */}
        <Box border="default" borderRadius="lg" p="md" bg="subtle">
          <Stack direction="column" gap="md">
            <Typography variant="h3">Add manually</Typography>
            
            <Stack direction="row" gap="sm" alignItems="flex-end">
              <TextField
                label="Ingredient"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder="e.g., chicken breast, tomatoes"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddItem();
                  }
                }}
                style={{ flex: 1 }}
              />
              <Button
                variant="secondary"
                size="medium"
                onClick={handleAddItem}
                disabled={!newItem.trim()}
              >
                Add
              </Button>
            </Stack>
          </Stack>
        </Box>

        {/* Items List */}
        <Box border="default" borderRadius="lg" p="md">
          <Stack direction="column" gap="sm">
            <Typography variant="subtitle">
              Your Items ({pantryItems.length})
            </Typography>

            {pantryItems.length === 0 ? (
              <Typography variant="small" color="subdued">
                💡 No items added yet. Scan a photo or add items manually above.
              </Typography>
            ) : (
              <Stack direction="column" gap="xs">
                {pantryItems.map((item, idx) => (
                  <Box
                    key={idx}
                    p="sm"
                    bg="subtle"
                    borderRadius="sm"
                  >
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Typography variant="body">• {item}</Typography>
                      <Stack direction="row" gap="sm" alignItems="center">
                        <BooleanChip
                          size="small"
                          selected={isUseSoon(pantry, item)}
                          onClick={() => onUpdatePantry(toggleUseSoon(pantry, item))}
                          aria-label={`Use ${item} soon`}
                        >
                          Use soon
                        </BooleanChip>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => handleRemoveItem(idx)}
                        >
                          Remove
                        </Button>
                      </Stack>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Stack>
        </Box>

        {/* Footer Actions */}
        <Stack direction="row" gap="md" justifyContent="flex-end">
          <Button
            variant="primary"
            size="large"
            onClick={onClose}
          >
            Done
          </Button>
        </Stack>
      </Stack>
    </Sheet>
  );
}
