"use client";

import { useState, useEffect } from "react";
import { Alert, Stack, Typography, IconButton, Button, Sheet, TextField, Dropdown } from "@common-origin/design-system";
import { type Recipe } from "@/lib/types/recipe";
import { RecipeLibrary } from "@/lib/library";
import { getFavorites } from "@/lib/storage";
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

type TabType = "ai" | "saved";

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
  const [activeTab, setActiveTab] = useState<TabType>("ai");
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
  const [filteredSavedRecipes, setFilteredSavedRecipes] = useState<Recipe[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBy, setFilterBy] = useState<"all" | "favorites">("all");
  const [favorites, setFavorites] = useState<string[]>([]);

  // Load saved recipes when drawer opens
  useEffect(() => {
    if (isOpen) {
      const customRecipes = RecipeLibrary.getCustomRecipes();
      setSavedRecipes(customRecipes);
      setFavorites(getFavorites());
      setSearchQuery("");
      setFilterBy("all");
      // Default to saved tab when adding new, AI tab when swapping
      const isAdding = !currentRecipe;
      setActiveTab(isAdding ? "saved" : "ai");
    }
  }, [isOpen, currentRecipe]);

  // Filter saved recipes
  useEffect(() => {
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

    setFilteredSavedRecipes(result);
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
  const title = isAddingNew ? `Add recipe for ${dayName}` : `Swap ${dayName} meal`;

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

        {/* Tabs */}
        <Stack direction="row" gap="md">
          <Button
            variant={activeTab === "ai" ? "primary" : "secondary"}
            size="medium"
            onClick={() => setActiveTab("ai")}
            style={{ flex: 1 }}
          >
            AI Suggestions
          </Button>
          <Button
            variant={activeTab === "saved" ? "primary" : "secondary"}
            size="medium"
            onClick={() => setActiveTab("saved")}
            style={{ flex: 1 }}
          >
            My Saved Recipes ({savedRecipes.length})
          </Button>
        </Stack>

        {/* AI Suggestions Tab */}
        {activeTab === "ai" && (
          <Stack direction="column" gap="md">
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h3">AI suggested alternatives</Typography>
              {onGenerateAISuggestions && (
                <Button
                  variant="primary"
                  size="medium"
                  onClick={onGenerateAISuggestions}
                  disabled={isGeneratingAI}
                >
                  {isGeneratingAI ? 'Generating...' : 'Generate'}
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
                    ? 'Click "Generate" to get personalized recipe alternatives'
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
                  swapButtonText="Select this recipe"
                  swapButtonVariant="primary"
                  viewRecipeButtonText="View recipe"
                  viewRecipeButtonVariant="secondary"
                />
              ))
            )}
          </Stack>
        )}

        {/* Saved Recipes Tab */}
        {activeTab === "saved" && (
          <Stack direction="column" gap="md">
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h3">Your saved recipes</Typography>
            </Stack>

            {/* Filters */}
            <Stack direction="row" gap="md">
              <div style={{ flex: 1 }}>
                <TextField
                  label="Search"
                  placeholder="Search recipes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div style={{ minWidth: '160px' }}>
                <Dropdown
                  label="Filter"
                  options={filterOptions}
                  value={filterBy}
                  onChange={(value) => setFilterBy(value as "all" | "favorites")}
                />
              </div>
            </Stack>

            {/* Recipes List */}
            {savedRecipes.length === 0 ? (
              <div style={{ 
                padding: "24px", 
                textAlign: "center",
                backgroundColor: "#f8f9fa",
                borderRadius: "8px"
              }}>
                <Typography variant="body">
                  No saved recipes yet. Add recipes from the Add Recipe page or generate them with AI.
                </Typography>
              </div>
            ) : filteredSavedRecipes.length === 0 ? (
              <div style={{ 
                padding: "24px", 
                textAlign: "center",
                backgroundColor: "#f8f9fa",
                borderRadius: "8px"
              }}>
                <Typography variant="body">
                  No recipes match your search or filter.
                </Typography>
              </div>
            ) : (
              <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
                <Stack direction="column" gap="md">
                  {filteredSavedRecipes.map((recipe) => (
                    <MealCard
                      key={recipe.id}
                      recipeId={recipe.id}
                      title={recipe.title}
                      chef={
                        recipe.id.startsWith("custom-ai-") 
                          ? "AI Generated" 
                          : recipe.source.chef === "jamie_oliver" 
                            ? "Jamie Oliver" 
                            : recipe.source.domain === "user-added"
                              ? "User Added"
                              : "RecipeTin Eats"
                      }
                      timeMins={recipe.timeMins || 0}
                      kidsFriendly={recipe.tags.includes('kid_friendly')}
                      reasons={recipe.tags.slice(0, 3)}
                      onSwapClick={() => handleSelectSwap(recipe)}
                      swapButtonText="Select this recipe"
                      swapButtonVariant="primary"
                      viewRecipeButtonText="View recipe"
                      viewRecipeButtonVariant="secondary"
                    />
                  ))}
                </Stack>
              </div>
            )}
          </Stack>
        )}
      </Stack>
    </Sheet>
  );
}
