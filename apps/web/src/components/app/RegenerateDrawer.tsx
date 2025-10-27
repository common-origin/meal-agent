"use client";

import { useState, useEffect } from "react";
import { Stack, Typography, Button } from "@common-origin/design-system";
import { type PlanWeek } from "@/lib/types/recipe";

interface RegenerateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onRegenerate: (pinnedDays: number[], constraints: RegenerateConstraints) => void;
  currentPlan: PlanWeek;
}

export interface RegenerateConstraints {
  maxCost?: number;
  maxIngredients?: number;
  preferredChef?: string;
  maximizeReuse?: boolean;
  kidFriendlyOnly?: boolean;
}

export default function RegenerateDrawer({
  isOpen,
  onClose,
  onRegenerate,
  currentPlan
}: RegenerateDrawerProps) {
  const [pinnedDays, setPinnedDays] = useState<Set<number>>(new Set());
  const [maxCost, setMaxCost] = useState<number>(currentPlan.costEstimate);
  const [maximizeReuse, setMaximizeReuse] = useState(false);
  const [kidFriendlyOnly, setKidFriendlyOnly] = useState(false);

  // Escape key handling
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePinToggle = (dayIndex: number) => {
    const newPinned = new Set(pinnedDays);
    if (newPinned.has(dayIndex)) {
      newPinned.delete(dayIndex);
    } else {
      newPinned.add(dayIndex);
    }
    setPinnedDays(newPinned);
  };

  const handleRegenerate = () => {
    const constraints: RegenerateConstraints = {
      maxCost,
      maximizeReuse,
      kidFriendlyOnly
    };
    onRegenerate(Array.from(pinnedDays), constraints);
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          zIndex: 999
        }}
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Regenerate meal plan"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "400px",
          maxWidth: "90vw",
          backgroundColor: "white",
          zIndex: 1000,
          padding: "24px",
          overflowY: "auto",
          boxShadow: "-2px 0 8px rgba(0, 0, 0, 0.1)"
        }}
      >
        <Stack direction="column" gap="xl">
          {/* Header */}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h3">Regenerate Plan</Typography>
            <button
              onClick={onClose}
              aria-label="Close regenerate drawer"
              style={{
                border: "none",
                background: "transparent",
                fontSize: "24px",
                cursor: "pointer",
                padding: "8px",
                minWidth: "44px",
                minHeight: "44px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              ✕
            </button>
          </Stack>

          {/* Pin Days Section */}
          <div role="group" aria-label="Pin specific days to keep their meals">
            <Typography variant="h4">Pin Days</Typography>
            <Typography variant="small">
              Lock specific meals to keep them when regenerating
            </Typography>
            <Stack direction="column" gap="sm">
              {currentPlan.days.map((day, index) => {
                const isPinned = pinnedDays.has(index);
                const dayId = `pin-day-${index}`;
                return (
                  <label
                    key={index}
                    htmlFor={dayId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "12px",
                      minHeight: "44px",
                      border: isPinned ? "2px solid #007bff" : "1px solid #e0e0e0",
                      borderRadius: "4px",
                      cursor: "pointer",
                      backgroundColor: isPinned ? "#f0f8ff" : "white"
                    }}
                  >
                    <input
                      id={dayId}
                      type="checkbox"
                      checked={isPinned}
                      onChange={() => handlePinToggle(index)}
                      style={{ 
                        cursor: "pointer",
                        width: "20px",
                        height: "20px"
                      }}
                      aria-label={`Pin day ${index + 1}: ${day.recipeId.split('-').slice(0, 3).join(' ')}`}
                    />
                    <Typography variant="body">
                      Day {index + 1}: {day.recipeId.split('-').slice(0, 3).join(' ')}
                    </Typography>
                  </label>
                );
              })}
            </Stack>
          </div>

          {/* Cost Constraint */}
          <div role="group" aria-label="Budget target slider">
            <Typography variant="h4">Budget Target</Typography>
            <Typography variant="small">
              Current: ${currentPlan.costEstimate.toFixed(2)}
            </Typography>
            <div style={{ marginTop: "8px" }}>
              <label htmlFor="budget-slider" style={{ display: "block", marginBottom: "8px" }}>
                <input
                  id="budget-slider"
                  type="range"
                  min={Math.floor(currentPlan.costEstimate * 0.7)}
                  max={Math.floor(currentPlan.costEstimate * 1.3)}
                  value={maxCost}
                  onChange={(e) => setMaxCost(Number(e.target.value))}
                  style={{ width: "100%", height: "44px", cursor: "pointer" }}
                  aria-label="Budget target slider"
                  aria-valuemin={Math.floor(currentPlan.costEstimate * 0.7)}
                  aria-valuemax={Math.floor(currentPlan.costEstimate * 1.3)}
                  aria-valuenow={maxCost}
                  aria-valuetext={`$${maxCost.toFixed(2)}`}
                />
              </label>
              <Typography variant="body" aria-live="polite">
                Target: ${maxCost.toFixed(2)}
              </Typography>
            </div>
          </div>

          {/* Toggle Options */}
          <div role="group" aria-label="Meal plan preferences">
            <Typography variant="h4">Preferences</Typography>
            <Stack direction="column" gap="sm">
              <label
                htmlFor="maximize-reuse"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px",
                  minHeight: "44px",
                  cursor: "pointer"
                }}
              >
                <input
                  id="maximize-reuse"
                  type="checkbox"
                  checked={maximizeReuse}
                  onChange={(e) => setMaximizeReuse(e.target.checked)}
                  style={{ 
                    cursor: "pointer",
                    width: "20px",
                    height: "20px"
                  }}
                  aria-describedby="maximize-reuse-desc"
                />
                <Typography variant="body">
                  ♻️ Maximize ingredient reuse (reduce pack waste)
                </Typography>
              </label>
              <span id="maximize-reuse-desc" style={{ display: "none" }}>
                Prioritize recipes that share common ingredients to reduce waste
              </span>

              <label
                htmlFor="kid-friendly-only"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px",
                  minHeight: "44px",
                  cursor: "pointer"
                }}
              >
                <input
                  id="kid-friendly-only"
                  type="checkbox"
                  checked={kidFriendlyOnly}
                  onChange={(e) => setKidFriendlyOnly(e.target.checked)}
                  style={{ 
                    cursor: "pointer",
                    width: "20px",
                    height: "20px"
                  }}
                  aria-describedby="kid-friendly-desc"
                />
                <Typography variant="body">
                  👶 Only kid-friendly meals
                </Typography>
              </label>
              <span id="kid-friendly-desc" style={{ display: "none" }}>
                Only show recipes suitable for children
              </span>
            </Stack>
          </div>

          {/* Actions */}
          <Stack direction="column" gap="md">
            <Button
              variant="primary"
              size="large"
              onClick={handleRegenerate}
              aria-label="Regenerate meal plan with selected constraints"
            >
              Regenerate Plan
            </Button>
            <Button
              variant="secondary"
              size="large"
              onClick={onClose}
              aria-label="Cancel and close drawer"
            >
              Cancel
            </Button>
          </Stack>
        </Stack>
      </div>
    </>
  );
}
