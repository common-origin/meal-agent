import type { Recipe } from "./types/recipe";
import { recipes } from "./recipes";
import { enhanceRecipeWithTags } from "./tagNormalizer";
import { Storage } from "./storage";
import { getFavorites } from "./storage";
import { TEMP_RECIPE_CLEANUP_DAYS } from "./constants";

// Library search interface (same as MockLibrary for compatibility)
export interface LibrarySearchOptions {
  chef?: string;
  tags?: string[];
  maxTime?: number;
  excludeIds?: string[];
  limit?: number;
  searchText?: string; // New: keyword search
}

const CUSTOM_RECIPES_KEY = "meal-agent:custom-recipes:v1"; // User-added recipes only
const CONFIRMED_RECIPES_KEY = "meal-agent:confirmed-recipes:v1"; // Track recipes confirmed in plans
const AI_TEMP_RECIPES_KEY = "meal-agent:ai-temp-recipes:v1"; // Temporary AI recipes for current plans

/**
 * Real Recipe Library
 * Uses pre-generated recipe data from build script
 * Enhanced with tag normalization and smart search
 * Supports custom recipes (AI-generated, user-added)
 */
export class RecipeLibrary {
  private static recipes: Recipe[] | null = null;
  private static customRecipes: Recipe[] | null = null;
  private static hasCleanedThisSession = false;

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
   * Load temporary AI recipes from localStorage
   * Automatically cleans up old recipes on load
   */
  private static loadTempAIRecipes(): Recipe[] {
    const recipes = Storage.get<Recipe[]>(AI_TEMP_RECIPES_KEY, []);
    
    // Auto-cleanup on first load (once per session)
    if (!this.hasCleanedThisSession) {
      this.hasCleanedThisSession = true;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - TEMP_RECIPE_CLEANUP_DAYS);
      
      const recentRecipes = recipes.filter(recipe => {
        const fetchedAt = new Date(recipe.source.fetchedAt);
        return fetchedAt > cutoffDate;
      });
      
      if (recentRecipes.length < recipes.length) {
        this.saveTempAIRecipes(recentRecipes);
        console.log(`🧹 Auto-cleaned ${recipes.length - recentRecipes.length} old AI recipes (older than ${TEMP_RECIPE_CLEANUP_DAYS} days)`);
        return recentRecipes;
      }
    }
    
    return recipes;
  }

  /**
   * Save temporary AI recipes to localStorage
   */
  private static saveTempAIRecipes(recipes: Recipe[]): boolean {
    return Storage.set(AI_TEMP_RECIPES_KEY, recipes);
  }

  /**
   * Clean up old temporary AI recipes (older than specified days)
   * Call this periodically to prevent unbounded storage growth
   */
  static cleanupOldTempRecipes(daysOld: number = TEMP_RECIPE_CLEANUP_DAYS): number {
    const tempRecipes = this.loadTempAIRecipes();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    // Filter out recipes older than cutoff
    const recentRecipes = tempRecipes.filter(recipe => {
      const fetchedAt = new Date(recipe.source.fetchedAt);
      return fetchedAt > cutoffDate;
    });
    
    const removedCount = tempRecipes.length - recentRecipes.length;
    
    if (removedCount > 0) {
      this.saveTempAIRecipes(recentRecipes);
      console.log(`🧹 Cleaned up ${removedCount} old temporary AI recipes (older than ${daysOld} days)`);
    }
    
    return removedCount;
  }

  /**
   * Get all recipes with enhanced tags (built-in + custom + temporary AI)
   */
  private static getEnhancedRecipes(): Recipe[] {
    if (!this.recipes) {
      // Enhance all recipes with inferred tags on first load
      this.recipes = recipes.map(r => enhanceRecipeWithTags(r));
    }
    
    // Combine built-in recipes with custom recipes and temporary AI recipes
    const customRecipes = this.loadCustomRecipes();
    const tempAIRecipes = this.loadTempAIRecipes();
    const allRecipes = [...this.recipes, ...customRecipes, ...tempAIRecipes];
    
    // Deduplicate by ID (prefer custom > temp AI > built-in)
    const recipeMap = new Map<string, Recipe>();
    for (const recipe of allRecipes) {
      if (!recipeMap.has(recipe.id)) {
        recipeMap.set(recipe.id, recipe);
      }
    }
    
    return Array.from(recipeMap.values());
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
   * Add temporary AI recipes (for current meal plans only, not "My Recipes")
   * These recipes are available for searching and planning but won't appear in "My Recipes"
   * unless explicitly favorited or added via other methods
   * 
   * Now saves to Supabase for authenticated users so recipes persist across sessions
   */
  static async addTempAIRecipes(newRecipes: Recipe[]): Promise<boolean> {
    if (newRecipes.length === 0) {
      console.log('No recipes to add');
      return true;
    }
    
    // Enhance all recipes with tags
    const enhancedNewRecipes = newRecipes.map(r => enhanceRecipeWithTags(r));
    
    // Save to Supabase FIRST for authenticated users (always attempt)
    const HybridStorage = await import('./hybridStorage');
    let savedCount = 0;
    for (const recipe of enhancedNewRecipes) {
      const saved = await HybridStorage.saveRecipe(recipe);
      if (saved) savedCount++;
    }
    console.log(`💾 Saved ${savedCount}/${enhancedNewRecipes.length} recipes to Supabase`);
    
    // Then update localStorage cache (check for duplicates here)
    const existingTemp = this.loadTempAIRecipes();
    const existingIds = new Set(existingTemp.map(r => r.id));
    const recipesToAdd = enhancedNewRecipes.filter(r => !existingIds.has(r.id));
    
    if (recipesToAdd.length > 0) {
      const allTemp = [...existingTemp, ...recipesToAdd];
      this.saveTempAIRecipes(allTemp);
      console.log(`✅ Added ${recipesToAdd.length} new recipes to localStorage cache`);
    } else {
      console.log('ℹ️ All recipes already exist in localStorage cache');
    }

    return true;
  }

  /**
   * Sync Supabase recipes to localStorage cache
   * Used on page load to ensure RecipeLibrary has access to all recipes from Supabase
   */
  static syncSupabaseRecipes(supabaseRecipes: Recipe[]): boolean {
    try {
      // Replace the entire temp AI recipes cache with Supabase recipes
      this.saveTempAIRecipes(supabaseRecipes);
      console.log(`✅ Synced ${supabaseRecipes.length} recipes from Supabase to localStorage cache`);
      return true;
    } catch (error) {
      console.error('Failed to sync Supabase recipes:', error);
      return false;
    }
  }

  /**
   * Add custom recipes (user-added via URL/image/manual entry)
   * These recipes will appear in "My Recipes"
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
    
    console.log(`✅ Added ${recipesToAdd.length} custom recipes to "My Recipes"`);

    return success;
  }

  /**
   * Remove custom recipe by ID
   * Removes from custom recipes, temp AI recipes, and Supabase
   */
  static async removeCustomRecipe(id: string): Promise<boolean> {
    let removed = false;
    
    // Remove from custom recipes
    const existingCustom = this.loadCustomRecipes();
    const filteredCustom = existingCustom.filter(r => r.id !== id);
    if (filteredCustom.length < existingCustom.length) {
      this.saveCustomRecipes(filteredCustom);
      removed = true;
      console.log(`✅ Removed ${id} from custom recipes`);
    }
    
    // Remove from temp AI recipes
    const existingTemp = this.loadTempAIRecipes();
    const filteredTemp = existingTemp.filter(r => r.id !== id);
    if (filteredTemp.length < existingTemp.length) {
      this.saveTempAIRecipes(filteredTemp);
      removed = true;
      console.log(`✅ Removed ${id} from temp AI recipes`);
    }
    
    // Remove from Supabase for authenticated users
    try {
      const HybridStorage = await import('./hybridStorage');
      const supabaseDeleted = await HybridStorage.deleteRecipe(id);
      if (supabaseDeleted) {
        console.log(`✅ Removed ${id} from Supabase`);
        removed = true;
      }
    } catch (error) {
      console.warn('Failed to remove from Supabase:', error);
    }
    
    if (!removed) {
      console.warn(`Recipe ${id} not found in any storage location`);
      return false;
    }

    return true;
  }

  /**
   * Clear all custom recipes
   */
  static clearCustomRecipes(): boolean {
    return this.saveCustomRecipes([]);
  }

  /**
   * Get only custom recipes ("My Recipes")
   * Includes:
   * - User-added recipes (via URL/image/manual entry)
   * - Favorited recipes (from any source including AI-generated)
   * 
   * Does NOT include:
   * - Temporary AI recipes (unless favorited)
   * - Built-in library recipes (unless favorited)
   */
  static getCustomRecipes(): Recipe[] {
    const userAddedRecipes = this.loadCustomRecipes();
    const favorites = getFavorites();
    
    // Combine all "My Recipes" sources
    const myRecipeIds = new Set([
      ...userAddedRecipes.map(r => r.id),
      ...favorites,
    ]);
    
    // Get all recipes (includes built-in, custom, and temp AI)
    const allRecipes = this.getEnhancedRecipes();
    
    // Return only recipes that are in the "My Recipes" set
    return allRecipes.filter(r => myRecipeIds.has(r.id));
  }

  /**
   * Check if a recipe is custom (not from built-in library)
   */
  static isCustomRecipe(id: string): boolean {
    const customRecipes = this.loadCustomRecipes();
    return customRecipes.some(r => r.id === id);
  }

  /**
   * Promote a temporary AI recipe to permanent custom recipe
   * This happens when a user favorites an AI-generated recipe
   */
  static promoteTempAIRecipeToCustom(recipeId: string): boolean {
    const tempRecipes = this.loadTempAIRecipes();
    const recipe = tempRecipes.find(r => r.id === recipeId);
    
    if (!recipe) {
      console.warn(`Temporary AI recipe ${recipeId} not found`);
      return false;
    }
    
    // Add to custom recipes
    const success = this.addCustomRecipes([recipe]);
    
    if (success) {
      console.log(`✅ Promoted AI recipe "${recipe.title}" to "My Recipes"`);
    }
    
    return success;
  }

  /**
   * Mark recipes as confirmed (user confirmed their week plan)
   * This adds them to "My Recipes"
   */
  static markRecipesAsConfirmed(recipeIds: string[]): boolean {
    const existing = Storage.get<string[]>(CONFIRMED_RECIPES_KEY, []);
    const combined = new Set([...existing, ...recipeIds]);
    return Storage.set(CONFIRMED_RECIPES_KEY, Array.from(combined));
  }

  /**
   * Get confirmed recipe IDs
   */
  static getConfirmedRecipeIds(): string[] {
    return Storage.get<string[]>(CONFIRMED_RECIPES_KEY, []);
  }

}
