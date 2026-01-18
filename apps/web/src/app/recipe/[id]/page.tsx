"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Stack, Typography, Box, Button, ChipGroup, IconButton, Alert } from "@common-origin/design-system";
import Main from "@/components/app/Main";
import { tokens } from "@common-origin/design-system";
import { toggleFavorite, isFavorite, getRecipeRating, saveRecipeRating, blockRecipe, isRecipeBlocked } from "@/lib/storage";
import { RecipeLibrary } from "@/lib/library";
import { type Recipe } from "@/lib/types/recipe";
import { track } from "@/lib/analytics";
import { getRecipeSourceDisplay } from "@/lib/recipeDisplay";
import { calculateSeasonalScore, isIngredientInSeason } from "@/lib/seasonal";
import { formatTagsForDisplay } from "@/lib/tagNormalizer";
import StarRating from "@/components/app/StarRating";

/**
 * Parse instruction text that may contain markdown bold syntax
 * Converts **text** to actual bold rendering
 */
function parseInstructionWithHeading(instruction: string): { heading: string | null; body: string } {
  // Match pattern like "**Heading:** rest of text" or "**Heading** rest of text"
  const match = instruction.match(/^\*\*([^*]+)\*\*:?\s*/);
  
  if (match) {
    return {
      heading: match[1].trim(),
      body: instruction.slice(match[0].length).trim()
    };
  }
  
  return { heading: null, body: instruction };
}

type RecipePageProps = {
  params: Promise<{ id: string }>;
};

export default function RecipePage({ params }: RecipePageProps) {
  const router = useRouter();
  const [id, setId] = useState<string>("");
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [favorited, setFavorited] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [blocked, setBlocked] = useState<boolean>(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState<boolean>(false);
  
  useEffect(() => {
    params.then((resolvedParams) => {
      setId(resolvedParams.id);
      setFavorited(isFavorite(resolvedParams.id));
      setRating(getRecipeRating(resolvedParams.id) || 0);
      setBlocked(isRecipeBlocked(resolvedParams.id));
      
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
  
  const handleRatingChange = (newRating: number) => {
    setRating(newRating);
    saveRecipeRating(id, newRating);
  };
  
  const handleBlockRecipe = () => {
    blockRecipe(id);
    setBlocked(true);
    setShowBlockConfirm(false);
  };
  
  if (!recipe) {
    return (
      <Main>
        <Stack direction="column" gap="lg">
          <Button 
            variant="secondary" 
            size="large"
            iconName="arrowLeft"
            onClick={() => router.back()}
          >
            Back
          </Button>
          <Typography variant="h1">Recipe not found</Typography>
          <Typography variant="body">
            The recipe with ID &quot;{id}&quot; could not be found.
          </Typography>
        </Stack>
      </Main>
    );
  }

  const chefName = getRecipeSourceDisplay(recipe);
  const isAIGenerated = recipe.id.startsWith("custom-ai-");

  return (
    <Main maxWidth={tokens.base.breakpoint.md}>
      <Stack direction="column" gap="xl">
        {/* Back button and favorite */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Button 
            variant="secondary" 
            size="large"
            iconName="arrowLeft"
            onClick={() => router.back()}
          >
            Back
          </Button>
          
          <IconButton
            variant={favorited ? "primary" : "secondary"}
            iconName={favorited ? "starFilled" : "star"}
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
              labels={formatTagsForDisplay([...new Set(recipe.tags)]).slice(0, 8)} 
              variant="dark" 
            />
          )}
        </Stack>

        {/* Rating */}
        {recipe.nutrition && (
          <Box border="subtle" borderRadius="lg" p="lg" bg="default">
            <Stack direction="column" gap="md">
              <Typography variant="h3">Nutrition (per serving)</Typography>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '16px' }}>
                <Stack direction="column" gap="xs">
                  <Typography variant="small" color="subdued">Calories</Typography>
                  <Typography variant="h3">{recipe.nutrition.calories}</Typography>
                  <Typography variant="small">kcal</Typography>
                </Stack>
                <Stack direction="column" gap="xs">
                  <Typography variant="small" color="subdued">Protein</Typography>
                  <Typography variant="h3">{recipe.nutrition.protein}g</Typography>
                </Stack>
                <Stack direction="column" gap="xs">
                  <Typography variant="small" color="subdued">Carbs</Typography>
                  <Typography variant="h3">{recipe.nutrition.carbs}g</Typography>
                </Stack>
                <Stack direction="column" gap="xs">
                  <Typography variant="small" color="subdued">Fat</Typography>
                  <Typography variant="h3">{recipe.nutrition.fat}g</Typography>
                </Stack>
              </div>
            </Stack>
          </Box>
        )}

        {/* Ingredients */}
        <Box border="subtle" borderRadius="lg" p="lg" bg="default">
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
          <Box border="subtle" borderRadius="lg" p="lg" bg="default">
            <Stack direction="column" gap="md">
              <Typography variant="h2">Instructions</Typography>
              
              <Stack direction="column" gap="md">
                {recipe.instructions.map((instruction, index) => {
                  const { heading, body } = parseInstructionWithHeading(instruction);
                  return (
                    <Stack key={index} direction="row" gap="md" alignItems="flex-start">
                      <div 
                        style={{ 
                          minWidth: '24px', 
                          height: '24px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          backgroundColor: tokens.semantic.color.background.emphasis,
                          font: tokens.semantic.typography.overline,
                          borderRadius: '999px',
                          color: 'white',
                          fontWeight: 600,
                          fontSize: '14px'
                        }}
                      >
                        {index + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <Typography variant="body">
                          {heading && <><strong>{heading}</strong>{' '}</>}
                          {body}
                        </Typography>
                      </div>
                    </Stack>
                  );
                })}
              </Stack>
            </Stack>
          </Box>
        ) : (
          <Box border="default" borderRadius="md" p="lg" bg="surface">
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

        {/* Rating */}
        <Box border="subtle" borderRadius="lg" p="lg" bg="default">
          <Stack direction="column" gap="md" alignItems="flex-start">
            <Typography variant="h3">Rate this recipe</Typography>
            <StarRating rating={rating} onChange={handleRatingChange} size="large" />
            {blocked && (
              <Alert variant="warning">
                This recipe is blocked and will not appear in future AI meal plans.
              </Alert>
            )}
            {!blocked && (
              <Button
                variant="secondary"
                size="medium"
                onClick={() => setShowBlockConfirm(true)}
              >
                Never show this recipe again
              </Button>
            )}
            {showBlockConfirm && (
              <Alert variant="warning">
                <Stack direction="column" gap="sm">
                  <Typography variant="body">
                    Are you sure? This recipe will not appear in future AI meal plans.
                  </Typography>
                  <Stack direction="row" gap="sm">
                    <Button variant="primary" size="small" onClick={handleBlockRecipe}>
                      Yes, block it
                    </Button>
                    <Button variant="secondary" size="small" onClick={() => setShowBlockConfirm(false)}>
                      Cancel
                    </Button>
                  </Stack>
                </Stack>
              </Alert>
            )}
          </Stack>
        </Box>

        {/* Source Attribution */}
        <Box border="default" borderRadius="md" p="md" bg="subtle">
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
    </Main>
  );
}