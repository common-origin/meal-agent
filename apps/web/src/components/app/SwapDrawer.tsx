"use client";

import Link from "next/link";
import { Stack, Typography, IconButton, ChipGroup, Button, Divider } from "@common-origin/design-system";
import { type Recipe } from "@/lib/types/recipe";
import { RecipeLibrary } from "@/lib/library";

export type SwapDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  dayName: string;
  currentRecipe: Recipe | null;
  suggestedSwaps: Recipe[];
  onSelectSwap: (recipe: Recipe) => void;
  onGenerateAISuggestions?: () => void;
  isGeneratingAI?: boolean;
};

export default function SwapDrawer({
  isOpen,
  onClose,
  dayName,
  currentRecipe,
  suggestedSwaps,
  onSelectSwap,
  onGenerateAISuggestions,
  isGeneratingAI = false
}: SwapDrawerProps) {
  if (!isOpen) return null;

  const handleSelectSwap = (recipe: Recipe) => {
    onSelectSwap(recipe);
    onClose();
  };

  return (
    <>
      {/* Overlay */}
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
        }}
        aria-hidden="true"
      />

      {/* Side Sheet */}
      <div
        role="dialog"
        aria-labelledby="swap-drawer-title"
        aria-modal="true"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "600px",
          maxWidth: "90vw",
          backgroundColor: "white",
          boxShadow: "-4px 0 12px rgba(0, 0, 0, 0.15)",
          zIndex: 1000,
          overflowY: "auto",
          padding: "24px"
        }}
      >
        {/* Header */}
        <Stack direction="column" gap="xl">
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
            <div style={{ 
              padding: "12px 16px",
              backgroundColor: "#f8f9fa",
              borderRadius: "8px",
              borderLeft: "4px solid #007bff"
            }}>
              <Typography variant="body">
                Current: <strong>{currentRecipe.title}</strong>
              </Typography>
            </div>
          )}

          {/* Suggested Swaps */}
          <Stack direction="column" gap="md">
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h3">Suggested alternatives</Typography>
              {onGenerateAISuggestions && (
                <Button
                  variant="primary"
                  size="medium"
                  onClick={onGenerateAISuggestions}
                  disabled={isGeneratingAI}
                >
                  {isGeneratingAI ? 'Generating...' : 'AI suggestions'}
                </Button>
              )}
            </Stack>
            
            {suggestedSwaps.length === 0 ? (
              <div style={{ 
                padding: "24px", 
                textAlign: "center",
                backgroundColor: "#f8f9fa",
                borderRadius: "8px"
              }}>
                <Typography variant="body">
                  {onGenerateAISuggestions 
                    ? 'Click "AI Suggestions" to get personalized recipe alternatives'
                    : 'No alternative recipes available for this day'
                  }
                </Typography>
              </div>
            ) : (
              suggestedSwaps.map((recipe) => (
                <div
                  key={recipe.id}
                  style={{
                    border: "1px solid #dee2e6",
                    borderRadius: "8px",
                    padding: "16px",
                    backgroundColor: "white"
                  }}
                >
                  <Stack direction="column" gap="sm">
                    <Typography variant="h4">{recipe.title}</Typography>
                    
                    <Stack direction="row" gap="md" alignItems="center">
                      <Typography variant="small">
                        {RecipeLibrary.isCustomRecipe(recipe.id) 
                          ? "AI Generated" 
                          : recipe.source.chef === "jamie_oliver" 
                            ? "Jamie Oliver" 
                            : "RecipeTin Eats"}
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
                    <Divider size="small" />
                    <Stack direction="row" gap="sm">
                      <Link href={`/recipe/${recipe.id}`} style={{ textDecoration: 'none' }}>
                        <Button
                          variant="secondary"
                          size="medium"
                          purpose="button"
                        >
                          View recipe
                        </Button>
                      </Link>
                      <Button
                        variant="primary"
                        size="medium"
                        onClick={() => handleSelectSwap(recipe)}
                      >
                        Select
                      </Button>
                    </Stack>
                  </Stack>
                </div>
              ))
            )}
          </Stack>
        </Stack>
      </div>
    </>
  );
}
