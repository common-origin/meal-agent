import type { Recipe } from "./types/recipe";
import { recipes } from "./recipes";
import { enhanceRecipeWithTags } from "./tagNormalizer";
import { Storage } from "./storage";

// Library search interface (same as MockLibrary for compatibility)
export interface LibrarySearchOptions {
  chef?: string;
  tags?: string[];
  maxTime?: number;
  excludeIds?: string[];
  limit?: number;
  searchText?: string; // New: keyword search
}

const CUSTOM_RECIPES_KEY = "meal-agent:custom-recipes:v1";

/**
 * Real Recipe Library
 * Uses pre-generated recipe data from build script
 * Enhanced with tag normalization and smart search
 * Supports custom recipes (AI-generated, user-added)
 */
export class RecipeLibrary {
  private static recipes: Recipe[] | null = null;
  private static customRecipes: Recipe[] | null = null;

  /**
   * Load custom recipes from localStorage
   */
  private static loadCustomRecipes(): Recipe[] {
    if (this.customRecipes === null) {
      this.customRecipes = Storage.get<Recipe[]>(CUSTOM_RECIPES_KEY, []);
    }
    return this.customRecipes || [];
  }

  /**
   * Save custom recipes to localStorage
   */
  private static saveCustomRecipes(recipes: Recipe[]): boolean {
    this.customRecipes = recipes;
    return Storage.set(CUSTOM_RECIPES_KEY, recipes);
  }

  /**
   * Get all recipes with enhanced tags (built-in + custom)
   */
  private static getEnhancedRecipes(): Recipe[] {
    if (!this.recipes) {
      // Enhance all recipes with inferred tags on first load
      this.recipes = recipes.map(r => enhanceRecipeWithTags(r));
    }
    
    // Combine built-in recipes with custom recipes
    const customRecipes = this.loadCustomRecipes();
    return [...this.recipes, ...customRecipes];
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

  /**
   * Add custom recipes (e.g., AI-generated)
   * Merges with existing custom recipes, avoiding duplicates by ID
   */
  static addCustomRecipes(newRecipes: Recipe[]): boolean {
    const existingCustom = this.loadCustomRecipes();
    const existingIds = new Set(existingCustom.map(r => r.id));
    
    // Filter out duplicates
    const recipesToAdd = newRecipes.filter(r => !existingIds.has(r.id));
    
    if (recipesToAdd.length === 0) {
      console.log('No new recipes to add (all duplicates)');
      return true;
    }
    
    // Enhance new recipes with tags
    const enhancedNewRecipes = recipesToAdd.map(r => enhanceRecipeWithTags(r));
    
    // Merge and save
    const allCustom = [...existingCustom, ...enhancedNewRecipes];
    const success = this.saveCustomRecipes(allCustom);
    
    console.log(`✅ Added ${recipesToAdd.length} custom recipes to library`);
    return success;
  }

  /**
   * Remove custom recipe by ID
   */
  static removeCustomRecipe(id: string): boolean {
    const existingCustom = this.loadCustomRecipes();
    const filtered = existingCustom.filter(r => r.id !== id);
    
    if (filtered.length === existingCustom.length) {
      console.warn(`Recipe ${id} not found in custom recipes`);
      return false;
    }
    
    return this.saveCustomRecipes(filtered);
  }

  /**
   * Clear all custom recipes
   */
  static clearCustomRecipes(): boolean {
    return this.saveCustomRecipes([]);
  }

  /**
   * Get only custom recipes
   */
  static getCustomRecipes(): Recipe[] {
    return this.loadCustomRecipes();
  }

  /**
   * Check if a recipe is custom (not from built-in library)
   */
  static isCustomRecipe(id: string): boolean {
    const customRecipes = this.loadCustomRecipes();
    return customRecipes.some(r => r.id === id);
  }
}
