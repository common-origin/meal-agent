"use client";

import { useState } from "react";
import { Sheet, Stack, Typography, TextField, Button } from "@common-origin/design-system";
import { addPriceReport } from "@/lib/userPriceReports";
import { track } from "@/lib/analytics";

export interface ReportPriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredientName: string;
  normalizedName: string;
  suggestedQuantity?: number;
  suggestedUnit?: string;
}

export default function ReportPriceModal({
  isOpen,
  onClose,
  ingredientName,
  normalizedName,
  suggestedQuantity = 1,
  suggestedUnit = 'unit',
}: ReportPriceModalProps) {
  const [price, setPrice] = useState<string>('');
  const [quantity, setQuantity] = useState<string>(suggestedQuantity.toString());
  const [unit, setUnit] = useState<string>(suggestedUnit);
  const [location, setLocation] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!price || parseFloat(price) <= 0) {
      alert('Please enter a valid price');
      return;
    }

    setSubmitting(true);

    try {
      addPriceReport({
        ingredientName,
        normalizedName,
        price: parseFloat(price),
        quantity: parseFloat(quantity) || 1,
        unit: unit || suggestedUnit,
        location: location.trim() || undefined,
      });

      track('price_reported', {
        ingredient: normalizedName,
        price: parseFloat(price),
        location: location.trim() || 'not_specified',
      });

      setSubmitted(true);
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (error) {
      console.error('Failed to submit price report:', error);
      alert('Failed to save price report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setPrice('');
    setQuantity(suggestedQuantity.toString());
    setUnit(suggestedUnit);
    setLocation('');
    setSubmitted(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Sheet
      isOpen={isOpen}
      onClose={handleClose}
      position="right"
      width="500px"
      title="Report actual price"
    >
      <Stack direction="column" gap="lg">
        {submitted ? (
            <Stack direction="column" gap="md" alignItems="center">
            <Typography variant="h2">✓ Thanks!</Typography>
            <div style={{ textAlign: 'center' }}>
              <Typography variant="body">
                Your price report helps improve accuracy for everyone.
              </Typography>
            </div>
          </Stack>
        ) : (
          <>
            <Stack direction="column" gap="xs">
              <Typography variant="h3">{ingredientName}</Typography>
              <Typography variant="small" color="subdued">
                Help improve pricing accuracy by reporting what you actually paid at Coles
              </Typography>
            </Stack>

            <Stack direction="column" gap="md">
              <TextField
                label="Price you paid (AUD) *"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g., 7.50"
              />

              <Stack direction="row" gap="md">
                <TextField
                  label="Quantity"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="e.g., 500"
                />
                <TextField
                  label="Unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="e.g., g, ml, unit"
                />
              </Stack>

              <TextField
                label="Location (optional)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Coles Sydney CBD"
                helperText="Helps track regional price differences"
              />

              <Typography variant="small" color="subdued">
                Example: If you paid $7.50 for a 500g pack of chicken breast, enter:
                Price: 7.50, Quantity: 500, Unit: g
              </Typography>
            </Stack>

            <Stack direction="row" gap="md" justifyContent="flex-end">
              <Button
                variant="secondary"
                size="medium"
                onClick={handleClose}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="medium"
                onClick={handleSubmit}
                disabled={submitting || !price}
              >
                {submitting ? 'Submitting...' : 'Submit price'}
              </Button>
            </Stack>
          </>
        )}
      </Stack>
    </Sheet>
  );
}
