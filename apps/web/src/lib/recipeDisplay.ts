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
