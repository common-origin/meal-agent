"use client";

import { Stack, Typography, IconButton, ChipGroup } from "@common-origin/design-system";
import { type Recipe } from "@/lib/types/recipe";

export type SwapDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  dayName: string;
  currentRecipe: Recipe | null;
  suggestedSwaps: Recipe[];
  onSelectSwap: (recipe: Recipe) => void;
};

export default function SwapDrawer({
  isOpen,
  onClose,
  dayName,
  currentRecipe,
  suggestedSwaps,
  onSelectSwap
}: SwapDrawerProps) {
  if (!isOpen) return null;

  const handleSelectSwap = (recipe: Recipe) => {
    onSelectSwap(recipe);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          zIndex: 999,
          opacity: isOpen ? 1 : 0,
          transition: "opacity 0.3s ease"
        }}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-labelledby="swap-drawer-title"
        aria-modal="true"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "white",
          borderTopLeftRadius: "16px",
          borderTopRightRadius: "16px",
          boxShadow: "0 -4px 12px rgba(0, 0, 0, 0.15)",
          zIndex: 1000,
          maxHeight: "80vh",
          overflowY: "auto",
          transform: isOpen ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.3s ease"
        }}
      >
        <div style={{ padding: "24px" }}>
          {/* Header */}
          <div style={{ marginBottom: "24px" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <div id="swap-drawer-title">
                <Typography variant="h2">
                  Swap {dayName} meal
                </Typography>
              </div>
              <IconButton
                variant="naked"
                iconName="close"
                size="medium"
                onClick={onClose}
                aria-label="Close swap drawer"
              />
            </Stack>
            
            {currentRecipe && (
              <div style={{ marginTop: "8px" }}>
                <Typography variant="body">
                  Current: <strong>{currentRecipe.title}</strong>
                </Typography>
              </div>
            )}
          </div>

          {/* Suggested Swaps */}
          <Stack direction="column" gap="md">
            <Typography variant="h4">Suggested alternatives</Typography>
            
            {suggestedSwaps.length === 0 ? (
              <div style={{ 
                padding: "24px", 
                textAlign: "center",
                backgroundColor: "#f8f9fa",
                borderRadius: "8px"
              }}>
                <Typography variant="body">
                  No alternative recipes available for this day
                </Typography>
              </div>
            ) : (
              suggestedSwaps.map((recipe) => (
                <button
                  key={recipe.id}
                  onClick={() => handleSelectSwap(recipe)}
                  style={{
                    border: "1px solid #dee2e6",
                    borderRadius: "8px",
                    padding: "16px",
                    backgroundColor: "white",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s ease"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#007bff";
                    e.currentTarget.style.backgroundColor = "#f8f9fa";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#dee2e6";
                    e.currentTarget.style.backgroundColor = "white";
                  }}
                >
                  <Stack direction="column" gap="sm">
                    <Typography variant="h4">{recipe.title}</Typography>
                    
                    <Stack direction="row" gap="md" alignItems="center">
                      <Typography variant="small">
                        {recipe.source.chef === "jamie_oliver" ? "Jamie Oliver" : "RecipeTin Eats"}
                      </Typography>
                      {recipe.timeMins && (
                        <Typography variant="small">
                          {recipe.timeMins} mins
                        </Typography>
                      )}
                      {recipe.costPerServeEst && (
                        <Typography variant="small">
                          ${recipe.costPerServeEst.toFixed(2)}/serve
                        </Typography>
                      )}
                    </Stack>

                    <ChipGroup 
                      labels={recipe.tags.slice(0, 3).map(tag => tag.replace(/_/g, " "))}
                      variant="default"
                    />
                  </Stack>
                </button>
              ))
            )}
          </Stack>
        </div>
      </div>
    </>
  );
}
