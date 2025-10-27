/**
 * Recipe Scoring System
 * Deterministic rules-based scoring for meal selection
 */

import type { Recipe, Household } from "./types/recipe";

/**
 * Scoring weights - centralized for easy tuning
 */
export const SCORING_WEIGHTS = {
  // Bonuses
  FAVORITE_BONUS: 50,
  INGREDIENT_REUSE_BONUS_PER_MATCH: 5,
  SAME_CHEF_BONUS: 10,
  BULK_COOK_BONUS: 8, // For leftovers strategy
  VALUE_BONUS_MAX: 15, // For cost-effective recipes
  HIGH_PROTEIN_BONUS: 5,
  ORGANIC_FRIENDLY_BONUS: 3,
  
  // Penalties
  PROTEIN_REPETITION_PENALTY_PER_USE: 15, // Penalize using same protein >1x
  RECENT_RECIPE_PENALTY: 30, // Used within repetition window
  COMPLEXITY_PENALTY_PER_INGREDIENT: 0.5, // Slight penalty for many ingredients
  
  // Pack size reuse value proxy
  PACK_REUSE_THRESHOLD: 2, // If ingredient appears 2+ times, consider pack savings
  PACK_REUSE_BONUS: 10,
} as const;

/**
 * Score explanation - tracks which rules fired
 */
export interface ScoreExplanation {
  score: number;
  reasons: string[];
  penalties: string[];
  bonuses: string[];
}

/**
 * Scoring context - state needed for scoring
 */
export interface ScoringContext {
  household: Household;
  isWeekend: boolean;
  selectedRecipes: Recipe[]; // Already selected for the week
  usedProteinTypes: Record<string, number>; // Track protein frequency
  ingredientCounts: Record<string, number>; // Track ingredient reuse
  recentRecipeIds: string[]; // Recipes used in last 3 weeks
  preferredChef?: string;
}

/**
 * Score a recipe based on context and constraints
 */
export function scoreRecipe(
  recipe: Recipe,
  context: ScoringContext
): ScoreExplanation {
  let score = 0;
  const reasons: string[] = [];
  const penalties: string[] = [];
  const bonuses: string[] = [];

  // === HARD FILTERS (return score 0 if failed) ===
  
  // Weeknight time constraint
  if (!context.isWeekend && (recipe.timeMins || 30) > 40) {
    return {
      score: 0,
      reasons: ["Failed weeknight time constraint (>40min)"],
      penalties: ["Exceeds weeknight time limit"],
      bonuses: []
    };
  }

  // Check if recipe meets kid-friendly requirement on weeknights
  const needsKidFriendly = !context.isWeekend && 
    context.household.diet.glutenLight; // Using as proxy for kid-friendly flag
  if (needsKidFriendly && !recipe.tags.includes("kid_friendly")) {
    return {
      score: 0,
      reasons: ["Failed kid-friendly requirement"],
      penalties: ["Not kid-friendly on weeknight"],
      bonuses: []
    };
  }

  // === SOFT SCORING ===
  
  // Base score
  score = 100;

  // Favorite bonus
  if (context.household.favorites.includes(recipe.id)) {
    score += SCORING_WEIGHTS.FAVORITE_BONUS;
    bonuses.push(`Favorite (+${SCORING_WEIGHTS.FAVORITE_BONUS})`);
    reasons.push("favorite");
  }

  // Recent recipe penalty (within 3 weeks)
  if (context.recentRecipeIds.includes(recipe.id)) {
    score -= SCORING_WEIGHTS.RECENT_RECIPE_PENALTY;
    penalties.push(`Recently used (-${SCORING_WEIGHTS.RECENT_RECIPE_PENALTY})`);
  }

  // Protein variety - penalize repetition
  const proteinType = getProteinType(recipe);
  if (proteinType) {
    const proteinCount = context.usedProteinTypes[proteinType] || 0;
    if (proteinCount > 0) {
      const penalty = proteinCount * SCORING_WEIGHTS.PROTEIN_REPETITION_PENALTY_PER_USE;
      score -= penalty;
      penalties.push(`Protein repetition: ${proteinType} (-${penalty})`);
    }
  }

  // Ingredient reuse bonus
  let reuseCount = 0;
  for (const ingredient of recipe.ingredients) {
    const ingName = normalizeIngredientName(ingredient.name);
    if (context.ingredientCounts[ingName]) {
      reuseCount++;
    }
  }
  if (reuseCount > 0) {
    const bonus = reuseCount * SCORING_WEIGHTS.INGREDIENT_REUSE_BONUS_PER_MATCH;
    score += bonus;
    bonuses.push(`Ingredient reuse: ${reuseCount} matches (+${bonus})`);
    reasons.push("reuses ingredients");
  }

  // Pack reuse value proxy - check for ingredients appearing multiple times
  const ingredientAppearances = countIngredientAppearances(
    recipe,
    context.selectedRecipes
  );
  for (const [ingName, count] of Object.entries(ingredientAppearances)) {
    if (count >= SCORING_WEIGHTS.PACK_REUSE_THRESHOLD) {
      score += SCORING_WEIGHTS.PACK_REUSE_BONUS;
      bonuses.push(`Pack reuse: ${ingName} (+${SCORING_WEIGHTS.PACK_REUSE_BONUS})`);
      reasons.push("best value");
      break; // Only count once per recipe
    }
  }

  // Cost value bonus
  if (recipe.costPerServeEst && recipe.costPerServeEst < 4) {
    const bonus = Math.floor(
      ((4 - recipe.costPerServeEst) / 4) * SCORING_WEIGHTS.VALUE_BONUS_MAX
    );
    score += bonus;
    bonuses.push(`Cost effective (+${bonus})`);
    reasons.push("best value");
  }

  // Bulk cook bonus (for leftovers strategy)
  if (recipe.tags.includes("bulk_cook")) {
    score += SCORING_WEIGHTS.BULK_COOK_BONUS;
    bonuses.push(`Bulk cook (+${SCORING_WEIGHTS.BULK_COOK_BONUS})`);
    reasons.push("bulk cook");
  }

  // High protein bonus (if household preference)
  if (context.household.diet.highProtein && recipe.tags.includes("high_protein")) {
    score += SCORING_WEIGHTS.HIGH_PROTEIN_BONUS;
    bonuses.push(`High protein (+${SCORING_WEIGHTS.HIGH_PROTEIN_BONUS})`);
  }

  // Organic friendly bonus (if household preference)
  if (context.household.diet.organicPreferred && recipe.tags.includes("organic_ok")) {
    score += SCORING_WEIGHTS.ORGANIC_FRIENDLY_BONUS;
    bonuses.push(`Organic friendly (+${SCORING_WEIGHTS.ORGANIC_FRIENDLY_BONUS})`);
  }

  // Preferred chef bonus
  if (context.preferredChef && recipe.source.chef === context.preferredChef) {
    score += SCORING_WEIGHTS.SAME_CHEF_BONUS;
    bonuses.push(`Preferred chef (+${SCORING_WEIGHTS.SAME_CHEF_BONUS})`);
  }

  // Complexity penalty (slight bias toward simpler recipes)
  const ingredientCount = recipe.ingredients.length;
  if (ingredientCount > 12) {
    const penalty = (ingredientCount - 12) * SCORING_WEIGHTS.COMPLEXITY_PENALTY_PER_INGREDIENT;
    score -= penalty;
    penalties.push(`Complex recipe (-${penalty.toFixed(1)})`);
  }

  // Time bonus for quick recipes
  if (recipe.timeMins && recipe.timeMins <= 30) {
    reasons.push("≤30m");
  } else if (recipe.timeMins && recipe.timeMins <= 40) {
    reasons.push("≤40m");
  }

  // Kid-friendly tag
  if (recipe.tags.includes("kid_friendly")) {
    reasons.push("kid-friendly");
  }

  return {
    score: Math.max(0, score), // Never negative
    reasons: Array.from(new Set(reasons)), // Deduplicate
    penalties,
    bonuses
  };
}

/**
 * Get protein type from recipe
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
    .replace(/\([^)]*\)/g, "") // Remove parentheses
    .replace(/[0-9]/g, "") // Remove numbers
    .replace(/\s+/g, " ") // Normalize spaces
    .trim()
    .split(" ")
    .slice(0, 2) // Take first 2 words
    .join(" ");
}

/**
 * Count how many times ingredients appear across recipes
 */
function countIngredientAppearances(
  recipe: Recipe,
  selectedRecipes: Recipe[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  
  // Count in current recipe
  for (const ing of recipe.ingredients) {
    const name = normalizeIngredientName(ing.name);
    counts[name] = (counts[name] || 0) + 1;
  }
  
  // Count in already selected recipes
  for (const selected of selectedRecipes) {
    for (const ing of selected.ingredients) {
      const name = normalizeIngredientName(ing.name);
      if (counts[name] !== undefined) {
        counts[name]++;
      }
    }
  }
  
  return counts;
}

/**
 * Score and rank multiple recipes, return top N
 */
export function scoreAndRank(
  candidates: Recipe[],
  context: ScoringContext,
  topN: number = 5
): Array<{ recipe: Recipe; explanation: ScoreExplanation }> {
  const scored = candidates
    .map(recipe => ({
      recipe,
      explanation: scoreRecipe(recipe, context)
    }))
    .filter(item => item.explanation.score > 0) // Remove hard-filtered recipes
    .sort((a, b) => b.explanation.score - a.explanation.score);

  return scored.slice(0, topN);
}
