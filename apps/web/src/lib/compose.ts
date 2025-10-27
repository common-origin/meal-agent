import type { Household, WeeklyOverrides, PlanWeek, PlanDay, Recipe } from "./types/recipe";
import { RecipeLibrary } from "./library";
import { nextWeekMondayISO } from "./schedule";

/**
 * Compose a week of meals based on household data and overrides
 */
export function composeWeek(
  household: Household,
  overrides?: WeeklyOverrides
): PlanWeek {
  const startISO = nextWeekMondayISO();
  const dinnerCount = overrides?.dinners || 5;
  const servings = overrides?.servingsPerMeal || 4;
  const kidFriendly = overrides?.kidFriendlyWeeknights ?? true;
  
  const days: PlanDay[] = [];
  const conflicts: string[] = [];
  let totalCost = 0;
  const usedProteinTypes: string[] = [];

  // Build days array (Monday = 0, Sunday = 6)
  for (let i = 0; i < dinnerCount; i++) {
    const dateISO = getDateISO(startISO, i);
    const isWeekend = i >= 5; // Saturday or Sunday
    
    // Find a suitable recipe
    const recipe = selectRecipe({
      isWeekend,
      kidFriendly,
      usedProteins: usedProteinTypes,
      favorites: household.favorites,
      excludedIds: days.map(d => d.recipeId)
    });

    if (recipe) {
      days.push({
        dateISO,
        recipeId: recipe.id,
        scaledServings: servings,
        notes: undefined,
        bulk: recipe.tags.includes("bulk_cook")
      });

      // Track protein type
      const proteinType = getProteinType(recipe);
      if (proteinType) {
        usedProteinTypes.push(proteinType);
      }

      // Add to cost
      totalCost += (recipe.costPerServeEst || 0) * servings;
    } else {
      conflicts.push(`No suitable recipe found for day ${i + 1}`);
    }
  }

  return {
    startISO,
    days,
    costEstimate: Math.round(totalCost * 100) / 100,
    conflicts
  };
}

/**
 * Select a recipe based on constraints
 */
function selectRecipe(options: {
  isWeekend: boolean;
  kidFriendly: boolean;
  usedProteins: string[];
  favorites: string[];
  excludedIds: string[];
}): Recipe | null {
  const { isWeekend, kidFriendly, usedProteins, favorites, excludedIds } = options;

  // Build search criteria
  const tags: string[] = [];
  let maxTime: number | undefined;

  if (!isWeekend) {
    // Weeknight constraints
    tags.push("quick");
    if (kidFriendly) {
      tags.push("kid_friendly");
    }
    maxTime = 40;
  }

  // Search for candidates
  let candidates = RecipeLibrary.search({ 
    tags, 
    maxTime,
    excludeIds: excludedIds 
  });

  if (candidates.length === 0) {
    // Relax constraints if no matches
    candidates = RecipeLibrary.search({ 
      maxTime: isWeekend ? undefined : 40,
      excludeIds: excludedIds 
    });
  }

  // Prioritize favorites
  const favoriteCandidates = candidates.filter(r => favorites.includes(r.id));
  if (favoriteCandidates.length > 0) {
    candidates = favoriteCandidates;
  }

  // Filter out overused proteins (max 2x same protein)
  const proteinCounts = usedProteins.reduce((acc, p) => {
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  candidates = candidates.filter(recipe => {
    const protein = getProteinType(recipe);
    if (!protein) return true;
    return (proteinCounts[protein] || 0) < 2;
  });

  // Return first match (could add more sophisticated selection logic)
  return candidates[0] || null;
}

/**
 * Get protein type from recipe tags
 */
function getProteinType(recipe: Recipe): string | null {
  const proteinTags = ["beef", "chicken", "pork", "fish", "lamb"];
  for (const tag of recipe.tags) {
    if (proteinTags.includes(tag)) {
      return tag;
    }
  }
  return null;
}

/**
 * Get ISO date string for a day offset from start
 */
function getDateISO(startISO: string, dayOffset: number): string {
  const date = new Date(startISO);
  date.setDate(date.getDate() + dayOffset);
  return date.toISOString().split('T')[0];
}

/**
 * Generate suggested swaps for a specific day
 */
export function getSuggestedSwaps(
  currentRecipeId: string,
  isWeekend: boolean,
  kidFriendly: boolean
): Recipe[] {
  const currentRecipe = RecipeLibrary.getById(currentRecipeId);
  if (!currentRecipe) return [];

  const tags: string[] = [];
  let maxTime: number | undefined;

  if (!isWeekend) {
    tags.push("quick");
    if (kidFriendly) {
      tags.push("kid_friendly");
    }
    maxTime = 40;
  }

  // Get candidates from same chef first
  let candidates = RecipeLibrary.search({
    chef: currentRecipe.source.chef,
    tags,
    maxTime,
    excludeIds: [currentRecipeId],
    limit: 3
  });

  // If not enough from same chef, add others
  if (candidates.length < 3) {
    const others = RecipeLibrary.search({
      tags,
      maxTime,
      excludeIds: [currentRecipeId, ...candidates.map(r => r.id)],
      limit: 3 - candidates.length
    });
    candidates = [...candidates, ...others];
  }

  return candidates.slice(0, 3);
}
