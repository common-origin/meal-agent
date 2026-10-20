"use client";

import { useState, useEffect, useMemo } from "react";
import { Alert, Box, EmptyState, Stack, Typography, IconButton, Sheet, SearchField, Dropdown } from "@common-origin/design-system";
import { type Recipe } from "@/lib/types/recipe";
import { RecipeLibrary } from "@/lib/library";
import { getFavorites } from "@/lib/storage";
import { getRecipeSourceDisplay } from "@/lib/recipeDisplay";
import MealCard from "./MealCard";

/**
 * Convert recipe properties to reason codes that the explainer understands
 */
function generateReasonCodes(recipe: Recipe, isFavorited: boolean): string[] {
  const reasons: string[] = [];
  
  // Time-based reasons
  if (recipe.timeMins && recipe.timeMins < 25) {
    reasons.push("quick");
  }
  
  // Favorite
  if (isFavorited) {
    reasons.push("favorite");
  }
  
  // Tag-based reasons
  if (recipe.tags.includes("kid_friendly")) {
    reasons.push("kid-friendly");
  }
  if (recipe.tags.includes("bulk_cook")) {
    reasons.push("bulk cook");
  }
  if (recipe.tags.includes("vegetarian")) {
    reasons.push("vegetarian");
  }
  if (recipe.tags.includes("high_protein")) {
    reasons.push("high-protein");
  }
  
  // Value-based reason
  if (recipe.costPerServeEst && recipe.costPerServeEst < 4) {
    reasons.push("best value");
  }
  
  return reasons;
}

export type SwapDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  dayName: string;
  currentRecipe: Recipe | null;
  onSelectSwap: (recipe: Recipe) => void;
};

export default function SwapDrawer({
  isOpen,
  onClose,
  dayName,
  currentRecipe,
  onSelectSwap,
}: SwapDrawerProps) {
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBy, setFilterBy] = useState<"all" | "favorites">("all");
  const [favorites, setFavorites] = useState<string[]>([]);

  // Load saved recipes when drawer opens. RecipeLibrary/getFavorites read
  // directly from localStorage with no subscription mechanism, so this is a
  // genuine external-store sync rather than derivable render-time state.
  useEffect(() => {
    if (isOpen) {
      const customRecipes = RecipeLibrary.getCustomRecipes();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSavedRecipes(customRecipes);
      setFavorites(getFavorites());
      setSearchQuery("");
      setFilterBy("all");
    }
  }, [isOpen]);

  // Filter saved recipes — pure derivation from other state, so compute it
  // during render instead of syncing a copy via an effect.
  const filteredSavedRecipes = useMemo(() => {
    let result = [...savedRecipes];

    if (filterBy === "favorites") {
      result = result.filter(r => favorites.includes(r.id));
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(r =>
        r.title.toLowerCase().includes(query) ||
        r.ingredients.some(ing => ing.name.toLowerCase().includes(query))
      );
    }

    return result;
  }, [savedRecipes, searchQuery, filterBy, favorites]);

  if (!isOpen) return null;

  const handleSelectSwap = (recipe: Recipe) => {
    onSelectSwap(recipe);
    onClose();
  };

  const filterOptions = [
    { id: "all", label: "All Recipes" },
    { id: "favorites", label: "Favorites Only" },
  ];

  const isAddingNew = !currentRecipe;
  // Typing a change on the plan replaced AI swaps (#38); this drawer is for your own recipes.
  const title = isAddingNew ? `Add a saved recipe for ${dayName}` : `Use a saved recipe for ${dayName}`;

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      position="right"
      width="600px"
      title={title}
    >
      <Stack direction="column" gap="xl">
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <div id="swap-drawer-title">
            <Typography variant="h2">
              {title}
            </Typography>
          </div>
          <IconButton
            variant="naked"
            iconName="close"
            size="medium"
            onClick={onClose}
            aria-label="Close drawer"
          />
        </Stack>
          
        {currentRecipe && (
          <Alert variant="info" inline>
            Current meal: {currentRecipe.title}
          </Alert>
        )}

        {/* Saved recipes */}
        <Stack direction="column" gap="md">
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h3">Your saved recipes ({savedRecipes.length})</Typography>
            </Stack>

            {/* Filters */}
            <Stack direction="column" gap="sm">
              <SearchField
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search by name or ingredient"
                aria-label="Search your saved recipes"
              />
              <Dropdown
                label="Filter"
                options={filterOptions}
                value={filterBy}
                onChange={(value) => setFilterBy(value as "all" | "favorites")}
              />
            </Stack>

            {/* Recipes List */}
            {savedRecipes.length === 0 ? (
              <EmptyState
                size="small"
                illustration="empty"
                title="No saved recipes yet"
                description="Add recipes from the Add Recipe page, or favourite a meal from your plan."
              />
            ) : filteredSavedRecipes.length === 0 ? (
              <EmptyState
                size="small"
                illustration="search"
                title="No matches"
                description="No saved recipes match your search or filter."
              />
            ) : (
              <Box maxHeight="60vh" overflowY="auto">
                <Stack direction="column" gap="md">
                  {filteredSavedRecipes.map((recipe) => {
                    const reasons = generateReasonCodes(recipe, favorites.includes(recipe.id));
                    const chef = getRecipeSourceDisplay(recipe);
                    
                    return (
                      <MealCard
                        key={recipe.id}
                        recipeId={recipe.id}
                        title={recipe.title}
                        chef={chef}
                        timeMins={recipe.timeMins || 0}
                        reasons={reasons}
                        onSwapClick={() => handleSelectSwap(recipe)}
                        disableLink={true}
                      />
                    );
                  })}
                </Stack>
              </Box>
            )}
          </Stack>
      </Stack>
    </Sheet>
  );
}
