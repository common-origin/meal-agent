import type { Household, WeeklyOverrides, PlanWeek, PlanDay, Recipe } from "./types/recipe";
import { RecipeLibrary } from "./library";
import { scoreAndRank, type ScoringContext } from "./scoring";
import { getRecentRecipeIds, recordWeekRecipes } from "./recencyTracker";
import { nextWeekMondayISO } from "./schedule";
import {
  DEFAULT_DINNERS_PER_WEEK,
  DEFAULT_SERVINGS_PER_MEAL,
  WEEKEND_START_DAY_INDEX,
  MAX_SUGGESTED_SWAPS,
  CANDIDATES_TO_SCORE_PER_SLOT
} from "./constants";

/**
 * Compose a week of meals using intelligent scoring and selection
 * Now with: scoring, variety enforcement, ingredient reuse, leftovers strategy
 */
export function composeWeek(
  household: Household,
  overrides?: WeeklyOverrides
): PlanWeek {
  const startISO = overrides?.weekOfISO || nextWeekMondayISO();
  const dinnerCount = overrides?.dinners || DEFAULT_DINNERS_PER_WEEK;
  const servings = overrides?.servingsPerMeal || DEFAULT_SERVINGS_PER_MEAL;
  const kidFriendly = overrides?.kidFriendlyWeeknights ?? true;
  
  const days: PlanDay[] = [];
  const conflicts: string[] = [];
  let totalCost = 0;
  const usedProteinTypes: Record<string, number> = {};
  const ingredientCounts: Record<string, number> = {};
  const selectedRecipes: Recipe[] = [];
  const recentRecipeIds = getRecentRecipeIds(startISO);
  const suggestedSwaps: Record<number, Recipe[]> = {};
  
  // Check if we should use leftovers strategy
  const enableLeftovers = dinnerCount >= 5; // Enable for 5+ dinners
  let bulkRecipeDay: number | null = null;

  // Build days array (Monday = 0, Sunday = 6)
  for (let i = 0; i < dinnerCount; i++) {
    const dateISO = getDateISO(startISO, i);
    const isWeekend = i >= WEEKEND_START_DAY_INDEX;
    
    // Skip second day if this is a bulk cook leftover day
    if (enableLeftovers && bulkRecipeDay !== null && i === bulkRecipeDay + 1) {
      // Use placeholder for leftover day
      days.push({
        dateISO,
        recipeId: days[bulkRecipeDay].recipeId, // Same recipe
        scaledServings: servings,
        notes: "Leftovers from previous day",
        bulk: true
      });
      continue;
    }
    
    // Build scoring context
    const context: ScoringContext = {
      household,
      isWeekend,
      selectedRecipes,
      usedProteinTypes,
      ingredientCounts,
      recentRecipeIds,
      preferredChef: undefined // Could be set from household preferences
    };
    
    // Get candidates based on constraints
    const candidates = getCandidatesForDay(context, kidFriendly, days.map(d => d.recipeId));
    
    if (candidates.length === 0) {
      conflicts.push(`No suitable recipes found for day ${i + 1}`);
      continue;
    }
    
    // Score and rank candidates
    const scored = scoreAndRank(candidates, context, CANDIDATES_TO_SCORE_PER_SLOT);
    
    if (scored.length === 0) {
      conflicts.push(`All candidates filtered out for day ${i + 1}`);
      continue;
    }
    
    // Select best recipe
    const { recipe, explanation } = scored[0];
    
    // Generate swap suggestions for this day
    suggestedSwaps[i] = getSuggestedSwaps(
      recipe.id,
      isWeekend,
      kidFriendly,
      household
    );
    
    // Check if this should be a bulk cook day
    const shouldBeBulk = enableLeftovers && 
                         bulkRecipeDay === null && 
                         i < dinnerCount - 1 && // Not last day
                         !isWeekend && // Weeknight preferred
                         recipe.tags.includes("bulk_cook");
    
    if (shouldBeBulk) {
      bulkRecipeDay = i;
    }
    
    days.push({
      dateISO,
      recipeId: recipe.id,
      scaledServings: servings,
      notes: undefined,
      bulk: shouldBeBulk,
      reasons: explanation.reasons.slice(0, 3) // Limit to 3 reasons for UI
    });
    
    // Update context tracking
    selectedRecipes.push(recipe);
    
    const proteinType = getProteinType(recipe);
    if (proteinType) {
      usedProteinTypes[proteinType] = (usedProteinTypes[proteinType] || 0) + 1;
    }
    
    // Track ingredient usage for reuse scoring
    for (const ingredient of recipe.ingredients) {
      const ingName = normalizeIngredientName(ingredient.name);
      ingredientCounts[ingName] = (ingredientCounts[ingName] || 0) + 1;
    }
    
    // Add to cost
    totalCost += (recipe.costPerServeEst || 0) * servings;
  }
  
  // Record this week's recipes in history
  recordWeekRecipes(startISO, days.map(d => d.recipeId));

  return {
    startISO,
    days,
    costEstimate: Math.round(totalCost * 100) / 100,
    conflicts,
    suggestedSwaps
  };
}

/**
 * Get candidate recipes for a specific day
 */
function getCandidatesForDay(
  context: ScoringContext,
  kidFriendly: boolean,
  excludeIds: string[]
): Recipe[] {
  const { isWeekend } = context;
  
  // Start with broad search
  let candidates = RecipeLibrary.search({
    maxTime: isWeekend ? undefined : 45, // Slightly relaxed from 40 to get more options
    excludeIds
  });
  
  // If it's a weeknight and we need kid-friendly, prefer those but don't hard filter yet
  // (scoring will handle it)
  if (!isWeekend && kidFriendly) {
    const kidFriendlyOptions = candidates.filter(r => r.tags.includes("kid_friendly"));
    if (kidFriendlyOptions.length >= 3) {
      candidates = kidFriendlyOptions; // Enough options, use them
    }
    // Otherwise keep all candidates and let scoring filter
  }
  
  return candidates;
}

/**
 * Get protein type from recipe tags
 */
function getProteinType(recipe: Recipe): string | null {
  const proteinTags = ["chicken", "beef", "pork", "fish", "lamb", "seafood"];
  for (const tag of recipe.tags) {
    if (proteinTags.includes(tag)) {
      return tag;
    }
  }
  return null;
}

/**
 * Normalize ingredient name for comparison
 */
function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[0-9]/g, "")
    .replace(/\s+or\s+.*$/g, '') // Remove "or" alternatives
    .replace(/\s+and\/or\s+.*$/g, '') // Remove "and/or" alternatives
    .replace(/^(fresh|dried|ground|chopped|sliced|diced|minced|grated|crushed|shredded|raw|cooked)\s+/g, '') // Remove prep descriptors
    .replace(/^(plain|greek|whole|full cream|low fat|reduced fat|extra virgin|unsalted|salted|canned|frozen)\s+/g, '') // Remove quality descriptors
    .replace(/\s+(plain|greek|whole|full cream|low fat|reduced fat|extra virgin|unsalted|salted|canned|frozen)$/g, '') // Remove trailing descriptors
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 2)
    .join(" ");
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
 * Generate suggested swaps for a specific day with scoring
 */
export function getSuggestedSwaps(
  currentRecipeId: string,
  isWeekend: boolean,
  kidFriendly: boolean,
  household?: Household
): Recipe[] {
  const currentRecipe = RecipeLibrary.getById(currentRecipeId);
  if (!currentRecipe) return [];

  // Get candidates from same chef first
  let candidates = RecipeLibrary.search({
    chef: currentRecipe.source.chef,
    maxTime: isWeekend ? undefined : 45,
    excludeIds: [currentRecipeId]
  });

  // If not enough from same chef, add others
  if (candidates.length < MAX_SUGGESTED_SWAPS * 2) {
    const others = RecipeLibrary.search({
      maxTime: isWeekend ? undefined : 45,
      excludeIds: [currentRecipeId, ...candidates.map(r => r.id)]
    });
    candidates = [...candidates, ...others];
  }
  
  // Score swaps if household data available
  if (household) {
    const context: ScoringContext = {
      household,
      isWeekend,
      selectedRecipes: [currentRecipe],
      usedProteinTypes: {},
      ingredientCounts: {},
      recentRecipeIds: getRecentRecipeIds()
    };
    
    const scored = scoreAndRank(candidates, context, MAX_SUGGESTED_SWAPS);
    return scored.map(s => s.recipe);
  }

  // Fallback: return first N
  return candidates.slice(0, MAX_SUGGESTED_SWAPS);
}
