import type { Recipe } from "./types/recipe";
import { recipes } from "./recipes";

// Library search interface (same as MockLibrary for compatibility)
export interface LibrarySearchOptions {
  chef?: string;
  tags?: string[];
  maxTime?: number;
  excludeIds?: string[];
  limit?: number;
}

/**
 * Real Recipe Library
 * Uses pre-generated recipe data from build script
 */
export class RecipeLibrary {
  private static recipes: Recipe[] = recipes;

  /**
   * Get all recipes
   */
  static getAll(): Recipe[] {
    return this.recipes;
  }

  /**
   * Search recipes with filters
   */
  static search(options: LibrarySearchOptions = {}): Recipe[] {
    let results = this.recipes;

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
    return this.recipes.find(r => r.id === id);
  }
}
