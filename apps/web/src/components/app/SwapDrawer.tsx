"use client";

import { Stack, Typography, IconButton, Button, Sheet } from "@common-origin/design-system";
import { type Recipe } from "@/lib/types/recipe";
import MealCard from "./MealCard";

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
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      position="right"
      width="600px"
      title={`Swap ${dayName} meal`}
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
                <MealCard
                  key={recipe.id}
                  recipeId={recipe.id}
                  title={recipe.title}
                  chef={recipe.source.chef === "jamie_oliver" ? "Jamie Oliver" : "RecipeTin Eats"}
                  timeMins={recipe.timeMins || 0}
                  kidsFriendly={recipe.tags.includes('kid_friendly')}
                  reasons={recipe.tags.slice(0, 3)}
                  onSwapClick={() => handleSelectSwap(recipe)}
                  showMenu={false}
                  swapButtonText="Select this recipe"
                  swapButtonVariant="primary"
                  viewRecipeButtonText="View recipe"
                  viewRecipeButtonVariant="secondary"
                />
              ))
            )}
          </Stack>
        </Stack>
    </Sheet>
  );
}
