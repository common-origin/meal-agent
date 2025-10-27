import type { Recipe } from "./types/recipe";
import { recipes } from "./recipes";
import { enhanceRecipeWithTags } from "./tagNormalizer";

// Library search interface (same as MockLibrary for compatibility)
export interface LibrarySearchOptions {
  chef?: string;
  tags?: string[];
  maxTime?: number;
  excludeIds?: string[];
  limit?: number;
  searchText?: string; // New: keyword search
}

/**
 * Real Recipe Library
 * Uses pre-generated recipe data from build script
 * Enhanced with tag normalization and smart search
 */
export class RecipeLibrary {
  private static recipes: Recipe[] | null = null;

  /**
   * Get all recipes with enhanced tags
   */
  private static getEnhancedRecipes(): Recipe[] {
    if (!this.recipes) {
      // Enhance all recipes with inferred tags on first load
      this.recipes = recipes.map(r => enhanceRecipeWithTags(r));
    }
    return this.recipes;
  }

  /**
   * Get all recipes
   */
  static getAll(): Recipe[] {
    return this.getEnhancedRecipes();
  }

  /**
   * Search recipes with filters
   */
  static search(options: LibrarySearchOptions = {}): Recipe[] {
    let results = this.getEnhancedRecipes();

    // Filter by chef
    if (options.chef) {
      results = results.filter(r => r.source.chef === options.chef);
    }

    // Filter by tags (recipe must have all specified tags)
    if (options.tags && options.tags.length > 0) {
      results = results.filter(r => 
        options.tags!.every(tag => r.tags.includes(tag))
      );
    }

    // Filter by max time
    if (options.maxTime !== undefined) {
      results = results.filter(r => (r.timeMins || 30) <= options.maxTime!);
    }

    // Keyword search in title and tags
    if (options.searchText) {
      const searchLower = options.searchText.toLowerCase();
      results = results.filter(r => 
        r.title.toLowerCase().includes(searchLower) ||
        r.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // Exclude specific IDs
    if (options.excludeIds && options.excludeIds.length > 0) {
      results = results.filter(r => !options.excludeIds!.includes(r.id));
    }

    // Limit results
    if (options.limit !== undefined && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Get recipe by ID
   */
  static getById(id: string): Recipe | undefined {
    return this.getEnhancedRecipes().find(r => r.id === id);
  }

  /**
   * Get recipes by tag
   */
  static getByTag(tag: string): Recipe[] {
    return this.getEnhancedRecipes().filter(r => r.tags.includes(tag));
  }

  /**
   * Get count of recipes by chef
   */
  static getChefCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const recipe of this.getEnhancedRecipes()) {
      const chef = recipe.source.chef;
      counts[chef] = (counts[chef] || 0) + 1;
    }
    return counts;
  }
}
