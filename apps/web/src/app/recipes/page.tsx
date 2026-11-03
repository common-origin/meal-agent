"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Stack, Typography, Box, Button, TextField, Dropdown, ResponsiveGrid, EmptyState, InlineAlert, Modal, tokens } from "@common-origin/design-system";
import Main from "@/components/app/Main";
import ButtonGroup from "@/components/app/ButtonGroup";
import { RecipeLibrary } from "@/lib/library";
import { getFavorites, toggleFavorite } from "@/lib/storage";
import { Storage } from "@/lib/storage";
import { type Recipe } from "@/lib/types/recipe";
import { track } from "@/lib/analytics";
import MealCard, { MealCardSkeleton } from "@/components/app/MealCard";
import { recipeSourceLabel } from "@/lib/recipeDisplay";

type FilterOption = "all" | "favorites" | "ai-generated" | "manual";

/** Recipes you added or saved from AI are deleted for good; a library recipe only leaves My Recipes (#179). */
const isOwnRecipe = (recipeId: string) => recipeId.startsWith("custom-") || recipeId.startsWith("ai-");
const deleteLabelFor = (recipeId: string) => (isOwnRecipe(recipeId) ? "Delete recipe" : "Remove from My recipes");
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
  // The delete Modal (#179). The recipe stays set while the Modal animates closed,
  // so its wording doesn't change on the way out; `deleteOpen` opens and closes it.
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // One delete at a time: a second press while one runs does nothing
  const deletingRef = useRef(false);
  const [confirmingClearAll, setConfirmingClearAll] = useState(false);
  // What the last delete did, shown on the page rather than in a browser dialog
  const [notice, setNotice] = useState<{ variant: "success" | "error"; text: string } | null>(null);

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
    setConfirmingClearAll(false);
    try {
      // Clear from localStorage
      RecipeLibrary.clearCustomRecipes();
      
      // Only the recipes you added are cleared; favourites and saved AI recipes stay (#179)
      setRecipes(RecipeLibrary.getCustomRecipes());
      setNotice({ variant: "success", text: "Deleted the recipes you added." });
      
      track('page_view', { page: 'saved_recipes_cleared' });
    } catch (error) {
      console.error("Failed to clear recipes:", error);
      setNotice({ variant: "error", text: "We couldn't delete your recipes. Please try again." });
    }
  };

  const handleDeleteRecipe = async (recipeId: string, recipeTitle: string) => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    setDeleteOpen(false);
    try {
      // Check if it's a user-added recipe (custom-* or ai-*)
      const isUserAdded = recipeId.startsWith('custom-') || recipeId.startsWith('ai-');
      
      if (isUserAdded) {
        // Actually delete user-added recipes (from localStorage and Supabase)
        const success = await RecipeLibrary.removeCustomRecipe(recipeId);
        if (success) {
          setRecipes(prev => prev.filter(r => r.id !== recipeId));
          setNotice({ variant: "success", text: `Deleted "${recipeTitle}".` });
        } else {
          setNotice({ variant: "error", text: `We couldn't delete "${recipeTitle}". Please try again.` });
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
        setNotice({ variant: "success", text: `Removed "${recipeTitle}" from My recipes.` });
      }
    } catch (error) {
      console.error("Failed to delete recipe:", error);
      setNotice({ variant: "error", text: `We couldn't delete "${recipeTitle}". Please try again.` });
    } finally {
      deletingRef.current = false;
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
      <Main maxWidth="1400px">
        <Stack direction="column" gap="xl">
          <Typography variant="h1">My saved recipes</Typography>
          {/* Skeleton cards mirroring the recipe card (#181); the status names what's loading */}
          <div role="status" aria-busy="true" aria-label="Loading your recipes">
            <span className="sr-only">Loading your recipes</span>
            <ResponsiveGrid cols={1} colsSm={2} colsMd={3} colsLg={4} gapX="4" gapY="4">
              {Array.from({ length: 8 }, (_, i) => (
                <MealCardSkeleton key={i} />
              ))}
            </ResponsiveGrid>
          </div>
        </Stack>
      </Main>
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

        {notice && <InlineAlert variant={notice.variant}>{notice.text}</InlineAlert>}

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
          <EmptyState
            size="small"
            illustration="empty"
            title="No saved recipes yet"
            description="Add your first recipe manually or generate one with AI"
            action={{
              label: "Add your first recipe",
              onClick: handleAddRecipe,
              variant: "primary",
              icon: "add"
            }}
          />
        ) : filteredRecipes.length === 0 ? (
          <EmptyState
            size="small"
            illustration="search"
            title="No recipes match your filters"
            description="Try adjusting your search or filter options"
            action={{
              label: "Clear Filters",
              onClick: () => {
                setSearchQuery("");
                setFilterBy("all");
              },
              variant: "secondary"
            }}
          />
        ) : (
          /* Recipe Grid */
          <ResponsiveGrid 
            cols={1} 
            colsSm={2} 
            colsMd={3} 
            colsLg={4}
            gapX="4"
            gapY="4"
          >
            {filteredRecipes.map((recipe) => {
              
              // Generate proper reason codes for the chips
              const reasons = generateReasonCodes(recipe, favorites.includes(recipe.id));

              return (
                <MealCard
                  key={recipe.id}
                  recipeId={recipe.id}
                  title={recipe.title}
                  chef={recipeSourceLabel(recipe) ?? ""}
                  // No time when it's unknown, rather than an invented one (#181)
                  timeMins={recipe.timeMins ?? 0}
                  nutrition={recipe.nutrition}
                  reasons={reasons}
                  deleteLabel={deleteLabelFor(recipe.id)}
                  onDeleteClick={() => {
                    setPendingDelete({ id: recipe.id, title: recipe.title });
                    setDeleteOpen(true);
                  }}
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
                onClick={() => setConfirmingClearAll(true)}
                // Destructive but not the page's main action: secondary, with danger text
                style={{ color: tokens.semantic.color.text.danger }}
              >
                Clear all
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

      {/* Confirmations (#179): what each action really does, in the design system's Modal */}
      <Modal
        isOpen={deleteOpen && pendingDelete !== null}
        onClose={() => setDeleteOpen(false)}
        title={pendingDelete && isOwnRecipe(pendingDelete.id) ? "Delete this recipe?" : "Remove from My recipes?"}
        size="small"
        actions={[
          { label: "Cancel", onClick: () => setDeleteOpen(false), variant: "secondary" },
          {
            label: pendingDelete ? deleteLabelFor(pendingDelete.id) : "Delete recipe",
            onClick: () => pendingDelete && handleDeleteRecipe(pendingDelete.id, pendingDelete.title),
            variant: "danger",
          },
        ]}
      >
        <Typography>
          {pendingDelete && isOwnRecipe(pendingDelete.id)
            ? `"${pendingDelete.title}" will be deleted. This can't be undone.`
            : `"${pendingDelete?.title ?? ""}" will be removed from My recipes. It stays in the recipe library.`}
        </Typography>
      </Modal>

      <Modal
        isOpen={confirmingClearAll}
        onClose={() => setConfirmingClearAll(false)}
        title="Delete the recipes you've added?"
        size="small"
        actions={[
          { label: "Cancel", onClick: () => setConfirmingClearAll(false), variant: "secondary" },
          { label: "Delete all", onClick: handleClearAllRecipes, variant: "danger" },
        ]}
      >
        <Typography>
          Every recipe you&apos;ve added will be deleted. Favourites and saved AI recipes stay. This can&apos;t be undone.
        </Typography>
      </Modal>
    </Main>
  );
}
