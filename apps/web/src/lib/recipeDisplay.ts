/**
 * Recipe Display Utilities
 * Helper functions for displaying recipe information consistently across the app
 */

import { type Recipe } from "./types/recipe";

/**
 * Get the display name for a recipe's source/chef
 * Returns the actual chef/source name without hardcoded mappings
 */
export function getRecipeSourceDisplay(recipe: Recipe): string {
  // For AI-generated custom recipes, show "AI Generated"
  if (recipe.id.startsWith("custom-ai-")) {
    return "AI Generated";
  }
  
  // For user-added recipes, use the custom source they provided
  if (recipe.source.domain === "user-added") {
    return recipe.source.chef || "User Added";
  }
  
  // For all other recipes, use the chef value directly
  // This works for any source name stored in the database
  return recipe.source.chef || "Unknown Source";
}

/**
 * The source as a recipe card shows it (#181): "AI generated", "Added by you"
 * for a recipe you added without a chef, else the chef's name; null when
 * unknown, so the card shows nothing rather than "Unknown Source".
 */
export function recipeSourceLabel(recipe: Recipe): string | null {
  if (recipe.id.startsWith("custom-ai-") || recipe.id.startsWith("ai-") || recipe.source.domain === "ai-generated") {
    return "AI generated";
  }
  if (recipe.source.domain === "user-added") {
    return recipe.source.chef || "Added by you";
  }
  return recipe.source.chef || null;
}
