"use client";

import { useEffect, useState } from "react";
import { Stack, Typography, Box, Button, ChipGroup, IconButton } from "@common-origin/design-system";
import { toggleFavorite, isFavorite } from "@/lib/storage";
import { RecipeLibrary } from "@/lib/library";
import { type Recipe } from "@/lib/types/recipe";
import { track } from "@/lib/analytics";
import Link from "next/link";

type RecipePageProps = {
  params: Promise<{ id: string }>;
};

export default function RecipePage({ params }: RecipePageProps) {
  const [id, setId] = useState<string>("");
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [favorited, setFavorited] = useState(false);
  
  useEffect(() => {
    params.then((resolvedParams) => {
      setId(resolvedParams.id);
      setFavorited(isFavorite(resolvedParams.id));
      
      // Load recipe from library
      const loadedRecipe = RecipeLibrary.getById(resolvedParams.id);
      setRecipe(loadedRecipe || null);
      
      if (loadedRecipe) {
        track('page_view', { 
          page: 'recipe',
          recipeId: resolvedParams.id,
          title: loadedRecipe.title,
          source: loadedRecipe.source.chef,
        });
      }
    });
  }, [params]);

  const handleFavoriteClick = () => {
    toggleFavorite(id);
    setFavorited(!favorited);
    track(favorited ? 'favorite_removed' : 'favorite_added', { recipeId: id });
  };
  
  if (!recipe) {
    return (
      <main style={{ padding: 24 }}>
        <Stack direction="column" gap="lg">
          <Link href="/plan" style={{ textDecoration: 'none' }}>
            <Button variant="secondary" size="large">
              ← Back to Plan
            </Button>
          </Link>
          <Typography variant="h1">Recipe not found</Typography>
          <Typography variant="body">
            The recipe with ID &quot;{id}&quot; could not be found.
          </Typography>
        </Stack>
      </main>
    );
  }

  const isAIGenerated = RecipeLibrary.isCustomRecipe(id);
  const chefName = isAIGenerated 
    ? "AI Generated" 
    : recipe.source.chef === "jamie_oliver" 
      ? "Jamie Oliver" 
      : "RecipeTin Eats";

  return (
    <main style={{ padding: 24, maxWidth: '900px', margin: '0 auto' }}>
      <Stack direction="column" gap="xl">
        {/* Back button and favorite */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Link href="/plan" style={{ textDecoration: 'none' }}>
            <Button variant="secondary" size="large">
              ← Back to Plan
            </Button>
          </Link>
          
          <IconButton
            variant={favorited ? "primary" : "secondary"}
            iconName={favorited ? "close" : "add"}
            size="medium"
            onClick={handleFavoriteClick}
            aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
          />
        </Stack>

        {/* Recipe Header */}
        <Stack direction="column" gap="md">
          <Typography variant="h1">{recipe.title}</Typography>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="body">By {chefName}</Typography>
            {recipe.timeMins && (
              <Typography variant="body">• {recipe.timeMins} mins</Typography>
            )}
            {recipe.serves && (
              <Typography variant="body">• Serves {recipe.serves}</Typography>
            )}
            {recipe.costPerServeEst && (
              <Typography variant="body">• ${recipe.costPerServeEst.toFixed(2)} per serve</Typography>
            )}
          </div>

          {recipe.tags && recipe.tags.length > 0 && (
            <ChipGroup 
              labels={recipe.tags.slice(0, 8).map(tag => tag.replace(/_/g, " "))} 
              variant="default" 
            />
          )}
        </Stack>

        {/* Ingredients */}
        <Box border="default" borderRadius="3" p="lg" bg="surface">
          <Stack direction="column" gap="md">
            <Typography variant="h2">Ingredients</Typography>
            
            <Stack direction="column" gap="sm">
              {recipe.ingredients.map((ingredient, index) => (
                <Stack key={index} direction="row" gap="sm" alignItems="baseline">
                  <Typography variant="body">•</Typography>
                  <Typography variant="body">
                    {ingredient.qty > 0 && `${ingredient.qty} `}
                    {ingredient.unit !== 'unit' && `${ingredient.unit} `}
                    {ingredient.name}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Stack>
        </Box>

        {/* Instructions */}
        {recipe.instructions && recipe.instructions.length > 0 ? (
          <Box border="default" borderRadius="3" p="lg" bg="surface">
            <Stack direction="column" gap="md">
              <Typography variant="h2">Instructions</Typography>
              
              <Stack direction="column" gap="md">
                {recipe.instructions.map((instruction, index) => (
                  <Stack key={index} direction="row" gap="md" alignItems="flex-start">
                    <div 
                      style={{ 
                        minWidth: '32px', 
                        height: '32px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        backgroundColor: 'var(--color-primary)',
                        borderRadius: '999px',
                        color: 'white',
                        fontWeight: 600,
                        fontSize: '14px'
                      }}
                    >
                      {index + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <Typography variant="body">{instruction}</Typography>
                    </div>
                  </Stack>
                ))}
              </Stack>
            </Stack>
          </Box>
        ) : (
          <Box border="default" borderRadius="3" p="lg" bg="surface">
            <Stack direction="column" gap="md">
              <Typography variant="h2">Preparation</Typography>
              <Typography variant="body">
                This recipe serves {recipe.serves || 4} people and takes approximately {recipe.timeMins || 30} minutes to prepare and cook.
              </Typography>
              <Typography variant="body">
                For detailed cooking instructions, please visit the source link below.
              </Typography>
            </Stack>
          </Box>
        )}

        {/* Source Attribution */}
        <Box border="default" borderRadius="3" p="md" bg="subtle">
          <Stack direction="column" gap="sm">
            <Typography variant="h4">Source</Typography>
            <Typography variant="small">
              {isAIGenerated ? (
                <>AI-generated recipe based on your family preferences</>
              ) : (
                <>
                  Recipe from {chefName}
                  {recipe.source.url && (
                    <>
                      {' • '}
                      <a 
                        href={recipe.source.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ color: '#007bff', textDecoration: 'underline' }}
                      >
                        View original
                      </a>
                    </>
                  )}
                </>
              )}
            </Typography>
            {recipe.source.domain && !isAIGenerated && (
              <Typography variant="small" color="subdued">
                {recipe.source.domain}
              </Typography>
            )}
          </Stack>
        </Box>
      </Stack>
    </main>
  );
}