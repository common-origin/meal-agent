"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Stack, Typography, Box, Button, TextField, Dropdown, ResponsiveGrid, IconButton } from "@common-origin/design-system";
import { RecipeLibrary } from "@/lib/library";
import { getFavorites, toggleFavorite } from "@/lib/storage";
import { type Recipe } from "@/lib/types/recipe";
import { track } from "@/lib/analytics";

type FilterOption = "all" | "favorites" | "ai-generated" | "manual";
type SortOption = "date-desc" | "date-asc" | "title-asc" | "title-desc";

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
        // Load from GitHub if configured
        await RecipeLibrary.loadFromGitHub();
        
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
      result = result.filter(r => r.id.startsWith("custom-ai-"));
    } else if (filterBy === "manual") {
      result = result.filter(r => r.id.startsWith("custom-") && !r.id.startsWith("custom-ai-"));
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

  const handleToggleFavorite = (recipeId: string) => {
    toggleFavorite(recipeId);
    setFavorites(getFavorites());
    track('page_view', { page: 'saved_recipes_favorite_toggle', recipeId });
  };

  const handleViewRecipe = (recipeId: string) => {
    router.push(`/recipe/${recipeId}`);
  };

  const handleAddRecipe = () => {
    router.push("/recipes/add");
  };

  const handleSyncGitHub = async () => {
    try {
      await RecipeLibrary.syncWithGitHub();
      const customRecipes = RecipeLibrary.getCustomRecipes();
      setRecipes(customRecipes);
      alert("Successfully synced with GitHub!");
    } catch (error) {
      console.error("Failed to sync:", error);
      alert("Failed to sync with GitHub. Check settings.");
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
    <main style={{ padding: 24, maxWidth: '1400px', margin: '0 auto' }}>
      <Stack direction="column" gap="xl">
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="column" gap="xs">
            <Typography variant="h1">My Saved Recipes</Typography>
            <Typography variant="body" color="subdued">
              {filteredRecipes.length} of {recipes.length} recipes
            </Typography>
          </Stack>
          <Stack direction="row" gap="md">
            <Button
              variant="secondary"
              size="large"
              onClick={handleSyncGitHub}
            >
              Sync GitHub
            </Button>
            <Button
              variant="primary"
              size="large"
              iconName="add"
              onClick={handleAddRecipe}
            >
              Add Recipe
            </Button>
          </Stack>
        </Stack>

        {/* Search and Filters */}
        <Stack direction="row" gap="md" alignItems="flex-end">
          <div style={{ flex: 1 }}>
            <TextField
              label="Search recipes"
              placeholder="Search by title, ingredient, or tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div style={{ minWidth: '200px' }}>
            <Dropdown
              label="Filter"
              options={filterOptions}
              value={filterBy}
              onChange={(value) => setFilterBy(value as FilterOption)}
            />
          </div>
          <div style={{ minWidth: '200px' }}>
            <Dropdown
              label="Sort"
              options={sortOptions}
              value={sortBy}
              onChange={(value) => setSortBy(value as SortOption)}
            />
          </div>
        </Stack>

        {/* Empty State */}
        {recipes.length === 0 ? (
          <Box 
            p="2xl" 
            bg="subtle" 
            borderRadius="3"
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
                Add Your First Recipe
              </Button>
            </Stack>
          </Box>
        ) : filteredRecipes.length === 0 ? (
          <Box 
            p="2xl" 
            bg="subtle" 
            borderRadius="3"
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
            {filteredRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                isFavorited={favorites.includes(recipe.id)}
                onToggleFavorite={handleToggleFavorite}
                onViewRecipe={handleViewRecipe}
              />
            ))}
          </ResponsiveGrid>
        )}
      </Stack>
    </main>
  );
}

// Recipe Card Component
function RecipeCard({ 
  recipe, 
  isFavorited, 
  onToggleFavorite, 
  onViewRecipe 
}: { 
  recipe: Recipe; 
  isFavorited: boolean;
  onToggleFavorite: (id: string) => void;
  onViewRecipe: (id: string) => void;
}) {
  const isAIGenerated = recipe.id.startsWith("custom-ai-");
  const chef = isAIGenerated 
    ? "AI Generated" 
    : recipe.source.chef === "jamie_oliver" 
      ? "Jamie Oliver" 
      : recipe.source.domain === "user-added"
        ? "User Added"
        : "RecipeTin Eats";

  return (
    <div
      style={{
        cursor: "pointer",
        transition: "box-shadow 0.2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none";
      }}
      onClick={() => onViewRecipe(recipe.id)}
    >
      <Box
        p="lg"
        bg="default"
        border="subtle"
        borderRadius="3"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          height: "100%",
        }}
      >
      {/* Header with favorite */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <div 
          style={{ 
            flex: 1, 
            minWidth: 0,
            overflow: "hidden", 
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          <Typography variant="h4">
            {recipe.title}
          </Typography>
        </div>
        <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          <IconButton
            variant={isFavorited ? "primary" : "secondary"}
            iconName={isFavorited ? "close" : "add"}
            size="small"
            onClick={() => onToggleFavorite(recipe.id)}
            aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
          />
        </div>
      </Stack>

      {/* Details */}
      <Stack direction="column" gap="xs">
        <Typography variant="small" color="subdued">
          {chef}
        </Typography>
        {recipe.timeMins && (
          <Typography variant="small" color="subdued">
            ⏱️ {recipe.timeMins} mins
          </Typography>
        )}
        <Typography variant="small" color="subdued">
          🍽️ {recipe.serves || 4} servings
        </Typography>
        {recipe.ingredients && (
          <Typography variant="small" color="subdued">
            📝 {recipe.ingredients.length} ingredients
          </Typography>
        )}
      </Stack>

      {/* Tags */}
      {recipe.tags && recipe.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
          {recipe.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              style={{
                padding: "2px 8px",
                borderRadius: "12px",
                backgroundColor: "#f0f0f0",
                fontSize: "11px",
                color: "#666",
              }}
            >
              {tag.replace(/_/g, " ")}
            </span>
          ))}
          {recipe.tags.length > 3 && (
            <span
              style={{
                padding: "2px 8px",
                fontSize: "11px",
                color: "#999",
              }}
            >
              +{recipe.tags.length - 3} more
            </span>
          )}
        </div>
      )}

        {/* View Button */}
        <Button
          variant="secondary"
          size="small"
          style={{ marginTop: "auto" }}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onViewRecipe(recipe.id);
          }}
        >
          View Recipe
        </Button>
      </Box>
    </div>
  );
}
