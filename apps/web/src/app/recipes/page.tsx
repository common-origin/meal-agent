"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Stack, Typography, Box, Button, TextField, Dropdown, ResponsiveGrid } from "@common-origin/design-system";
import Main from "@/components/app/Main";
import ButtonGroup from "@/components/app/ButtonGroup";
import { RecipeLibrary } from "@/lib/library";
import { getFavorites, toggleFavorite } from "@/lib/storage";
import { Storage } from "@/lib/storage";
import { type Recipe } from "@/lib/types/recipe";
import { track } from "@/lib/analytics";
import MealCard from "@/components/app/MealCard";
import { getRecipeSourceDisplay } from "@/lib/recipeDisplay";

type FilterOption = "all" | "favorites" | "ai-generated" | "manual";
type SortOption = "date-desc" | "date-asc" | "title-asc" | "title-desc";

/**
 * Convert recipe properties to reason codes that the explainer understands
 */
function generateReasonCodes(recipe: Recipe, isFavorited: boolean): string[] {
  const reasons: string[] = [];
  
  // Time-based reasons (only recipes under 25 mins are "quick")
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

export default function RecipesPage() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [filteredRecipes, setFilteredRecipes] = useState<Recipe[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");
  const [sortBy, setSortBy] = useState<SortOption>("date-desc");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Load recipes on mount
  useEffect(() => {
    const loadRecipes = async () => {
      setLoading(true);
      try {
        const customRecipes = RecipeLibrary.getCustomRecipes();
        setRecipes(customRecipes);
        setFavorites(getFavorites());
        
        track('page_view', { page: 'saved_recipes', count: customRecipes.length });
      } catch (error) {
        console.error("Failed to load recipes:", error);
      } finally {
        setLoading(false);
      }
    };

    loadRecipes();
  }, []);

  // Apply filters and sorting
  useEffect(() => {
    let result = [...recipes];

    // Filter by type
    if (filterBy === "favorites") {
      result = result.filter(r => favorites.includes(r.id));
    } else if (filterBy === "ai-generated") {
      // AI-generated recipes have IDs starting with "ai-"
      result = result.filter(r => r.id.startsWith("ai-"));
    } else if (filterBy === "manual") {
      // User-added recipes have IDs starting with "custom-"
      result = result.filter(r => r.id.startsWith("custom-"));
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(r => 
        r.title.toLowerCase().includes(query) ||
        r.ingredients.some(ing => ing.name.toLowerCase().includes(query)) ||
        r.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "date-desc":
          return new Date(b.source.fetchedAt).getTime() - new Date(a.source.fetchedAt).getTime();
        case "date-asc":
          return new Date(a.source.fetchedAt).getTime() - new Date(b.source.fetchedAt).getTime();
        case "title-asc":
          return a.title.localeCompare(b.title);
        case "title-desc":
          return b.title.localeCompare(a.title);
        default:
          return 0;
      }
    });

    setFilteredRecipes(result);
  }, [recipes, searchQuery, filterBy, sortBy, favorites]);



  const handleAddRecipe = () => {
    router.push("/recipes/add");
  };

  const handleClearAllRecipes = async () => {
    if (!confirm("Are you sure you want to delete ALL saved recipes? This action cannot be undone.")) {
      return;
    }

    try {
      // Clear from localStorage
      RecipeLibrary.clearCustomRecipes();
      
      // Update UI
      setRecipes([]);
      alert("All recipes have been cleared!");
      
      track('page_view', { page: 'saved_recipes_cleared' });
    } catch (error) {
      console.error("Failed to clear recipes:", error);
      alert("Failed to clear recipes. Check console for details.");
    }
  };

  const handleDeleteRecipe = async (recipeId: string, recipeTitle: string) => {
    if (!confirm(`Remove "${recipeTitle}" from My Recipes?`)) {
      return;
    }

    try {
      // Check if it's a user-added recipe (custom-* or ai-*)
      const isUserAdded = recipeId.startsWith('custom-') || recipeId.startsWith('ai-');
      
      if (isUserAdded) {
        // Actually delete user-added recipes (from localStorage and Supabase)
        const success = await RecipeLibrary.removeCustomRecipe(recipeId);
        if (success) {
          setRecipes(prev => prev.filter(r => r.id !== recipeId));
          alert(`Recipe "${recipeTitle}" has been deleted`);
        } else {
          alert('Failed to delete recipe.');
        }
      } else {
        // For built-in recipes, just unfavorite and remove from confirmed list
        // This removes them from "My Recipes" without deleting them from the library
        if (favorites.includes(recipeId)) {
          toggleFavorite(recipeId);
          setFavorites(prev => prev.filter(id => id !== recipeId));
        }
        
        // Remove from confirmed recipes
        const confirmedIds = RecipeLibrary.getConfirmedRecipeIds();
        const updatedConfirmed = confirmedIds.filter(id => id !== recipeId);
        Storage.set('meal-agent:confirmed-recipes:v1', updatedConfirmed);
        
        // Update local state
        setRecipes(prev => prev.filter(r => r.id !== recipeId));
        alert(`Recipe "${recipeTitle}" has been removed from My Recipes`);
      }
    } catch (error) {
      console.error("Failed to delete recipe:", error);
      alert("Failed to delete recipe. Check console for details.");
    }
  };

  const filterOptions = [
    { id: "all", label: "All Recipes" },
    { id: "favorites", label: "Favorites" },
    { id: "ai-generated", label: "AI Generated" },
    { id: "manual", label: "Manually Added" },
  ];

  const sortOptions = [
    { id: "date-desc", label: "Newest First" },
    { id: "date-asc", label: "Oldest First" },
    { id: "title-asc", label: "Title (A-Z)" },
    { id: "title-desc", label: "Title (Z-A)" },
  ];

  if (loading) {
    return (
      <main style={{ padding: 24, maxWidth: '1400px', margin: '0 auto' }}>
        <Typography variant="h1">Loading recipes...</Typography>
      </main>
    );
  }

  return (
    <Main maxWidth="1400px">
      <Stack direction="column" gap="xl">
        {/* Header */}
        <Stack direction="column" gap="xs">
          <Typography variant="h1">My saved recipes</Typography>
          <Typography variant="body" color="subdued">
            {filteredRecipes.length} of {recipes.length} recipes
          </Typography>
        </Stack>

        {/* Search and Filters */}
        <Stack direction="row" gap="md" alignItems="flex-end">
          <Box width="100%" maxWidth="400px">
            <TextField
              label="Search recipes"
              placeholder="Search by title, ingredient, or tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </Box>
          <Box width="100%" maxWidth="200px">
            <Dropdown
              label="Filter"
              options={filterOptions}
              value={filterBy}
              onChange={(value) => setFilterBy(value as FilterOption)}
            />
          </Box>
          <Box width="100%" maxWidth="200px">
            <Dropdown
              label="Sort"
              options={sortOptions}
              value={sortBy}
              onChange={(value) => setSortBy(value as SortOption)}
            />
          </Box>
        </Stack>

        {/* Empty State */}
        {recipes.length === 0 ? (
          <Box 
            p="2xl" 
            bg="subtle" 
            borderRadius="md"
            style={{ textAlign: "center" }}
          >
            <Stack direction="column" gap="lg" alignItems="center">
              <Typography variant="h2">No saved recipes yet</Typography>
              <Typography variant="body" color="subdued">
                Add your first recipe manually or generate one with AI
              </Typography>
              <Button
                variant="primary"
                size="large"
                iconName="add"
                onClick={handleAddRecipe}
              >
                Add your first recipe
              </Button>
            </Stack>
          </Box>
        ) : filteredRecipes.length === 0 ? (
          <Box 
            p="2xl" 
            bg="subtle" 
            borderRadius="md"
            style={{ textAlign: "center" }}
          >
            <Stack direction="column" gap="md" alignItems="center">
              <Typography variant="h3">No recipes match your filters</Typography>
              <Typography variant="body" color="subdued">
                Try adjusting your search or filter options
              </Typography>
              <Button
                variant="secondary"
                size="medium"
                onClick={() => {
                  setSearchQuery("");
                  setFilterBy("all");
                }}
              >
                Clear Filters
              </Button>
            </Stack>
          </Box>
        ) : (
          /* Recipe Grid */
          <ResponsiveGrid 
            cols={1} 
            colsSm={2} 
            colsMd={3} 
            colsLg={4}
            gapX={4}
            gapY={6}
          >
            {filteredRecipes.map((recipe) => {
              // Get chef/source display name
              const chef = getRecipeSourceDisplay(recipe);
              
              // Generate proper reason codes for the chips
              const reasons = generateReasonCodes(recipe, favorites.includes(recipe.id));

              return (
                <MealCard
                  key={recipe.id}
                  recipeId={recipe.id}
                  title={recipe.title}
                  chef={chef}
                  timeMins={recipe.timeMins || 30}
                  reasons={reasons}
                  onDeleteClick={() => handleDeleteRecipe(recipe.id, recipe.title)}
                />
              );
            })}
          </ResponsiveGrid>
        )}
      </Stack>

      <ButtonGroup 
        right={
          <>
            {recipes.length > 0 && (
              <Button
                variant="secondary"
                size="large"
                onClick={handleClearAllRecipes}
                style={{ color: '#d32f2f' }}
              >
                Clear All
              </Button>
            )}
            <Button
              variant="primary"
              size="large"
              iconName="add"
              onClick={handleAddRecipe}
            >
              Add recipe
            </Button>
          </>
        }
      />
    </Main>
  );
}
