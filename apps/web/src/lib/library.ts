import type { Recipe } from "./types/recipe";
import { recipes } from "./recipes";
import { enhanceRecipeWithTags } from "./tagNormalizer";
import { Storage } from "./storage";
import { GitHubClient } from "./github/client";
import { getFamilySettings, getFavorites } from "./storage";

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
 * Syncs with GitHub for backup and cross-device access
 */
export class RecipeLibrary {
  private static recipes: Recipe[] | null = null;
  private static customRecipes: Recipe[] | null = null;
  private static githubClient: GitHubClient | null = null;
  private static syncInProgress = false;

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
   */
  private static loadTempAIRecipes(): Recipe[] {
    return Storage.get<Recipe[]>(AI_TEMP_RECIPES_KEY, []);
  }

  /**
   * Save temporary AI recipes to localStorage
   */
  private static saveTempAIRecipes(recipes: Recipe[]): boolean {
    return Storage.set(AI_TEMP_RECIPES_KEY, recipes);
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
    return [...this.recipes, ...customRecipes, ...tempAIRecipes];
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
   */
  static addTempAIRecipes(newRecipes: Recipe[]): boolean {
    const existingTemp = this.loadTempAIRecipes();
    const existingIds = new Set(existingTemp.map(r => r.id));
    
    // Filter out duplicates
    const recipesToAdd = newRecipes.filter(r => !existingIds.has(r.id));
    
    if (recipesToAdd.length === 0) {
      console.log('No new temporary AI recipes to add (all duplicates)');
      return true;
    }
    
    // Enhance new recipes with tags
    const enhancedNewRecipes = recipesToAdd.map(r => enhanceRecipeWithTags(r));
    
    // Merge and save
    const allTemp = [...existingTemp, ...enhancedNewRecipes];
    const success = this.saveTempAIRecipes(allTemp);
    
    console.log(`✅ Added ${recipesToAdd.length} temporary AI recipes (for planning only)`);

    return success;
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

    // Auto-sync to GitHub if enabled (fire and forget)
    this.saveToGitHub().catch(error => {
      console.warn('Failed to sync to GitHub:', error);
    });

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
    
    const success = this.saveCustomRecipes(filtered);

    // Auto-sync to GitHub if enabled (fire and forget)
    this.saveToGitHub().catch(error => {
      console.warn('Failed to sync to GitHub:', error);
    });

    return success;
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

  /**
   * Initialize GitHub client from settings
   */
  private static getGitHubClient(): GitHubClient | null {
    const settings = getFamilySettings();
    
    if (!settings.github?.enabled || !settings.github.token || !settings.github.owner || !settings.github.repo) {
      return null;
    }

    if (!this.githubClient) {
      this.githubClient = new GitHubClient(
        settings.github.token,
        settings.github.owner,
        settings.github.repo
      );
    }

    return this.githubClient;
  }

  /**
   * Load recipes from GitHub (called on app startup)
   */
  static async loadFromGitHub(): Promise<{ success: boolean; count?: number; error?: string }> {
    const client = this.getGitHubClient();
    
    if (!client) {
      // GitHub not configured, use localStorage only
      return { success: true, count: this.loadCustomRecipes().length };
    }

    try {
      console.log('📥 Loading recipes from GitHub...');
      const result = await client.getRecipes();

      if (result.error) {
        console.error('Failed to load from GitHub:', result.error);
        // Fallback to localStorage
        return { success: false, error: result.error };
      }

      // Update localStorage cache with GitHub data
      if (result.recipes.length > 0) {
        this.saveCustomRecipes(result.recipes);
        console.log(`✅ Loaded ${result.recipes.length} recipes from GitHub`);
      }

      return { success: true, count: result.recipes.length };
    } catch (error) {
      console.error('Error loading from GitHub:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Save recipes to GitHub (called after adding/removing recipes)
   */
  static async saveToGitHub(): Promise<{ success: boolean; error?: string }> {
    const client = this.getGitHubClient();
    
    if (!client) {
      // GitHub not configured, skip sync
      return { success: true };
    }

    const settings = getFamilySettings();
    if (!settings.github?.autoSync) {
      // Auto-sync disabled, queue for manual sync
      return { success: true };
    }

    if (this.syncInProgress) {
      console.log('⏳ Sync already in progress, skipping...');
      return { success: true };
    }

    try {
      this.syncInProgress = true;
      console.log('📤 Saving recipes to GitHub...');

      const customRecipes = this.loadCustomRecipes();

      // Get current SHA (needed to update file)
      const currentState = await client.getRecipes();
      
      const result = await client.saveRecipes(customRecipes, currentState.sha);

      if (result.success) {
        console.log(`✅ Saved ${customRecipes.length} recipes to GitHub`);
      } else {
        console.error('Failed to save to GitHub:', result.error);
      }

      return result;
    } catch (error) {
      console.error('Error saving to GitHub:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Manual sync: merge local and remote recipes
   */
  static async syncWithGitHub(): Promise<{ 
    success: boolean; 
    added?: number; 
    updated?: number;
    error?: string 
  }> {
    const client = this.getGitHubClient();
    
    if (!client) {
      return { success: false, error: 'GitHub not configured' };
    }

    try {
      console.log('🔄 Syncing with GitHub...');

      // Get local recipes
      const localRecipes = this.loadCustomRecipes();
      const localIds = new Set(localRecipes.map(r => r.id));

      // Get remote recipes
      const remoteResult = await client.getRecipes();
      if (remoteResult.error) {
        return { success: false, error: remoteResult.error };
      }

      const remoteRecipes = remoteResult.recipes;

      // Merge: local recipes take precedence (last write wins)
      const mergedRecipes = [...localRecipes];
      let added = 0;

      for (const remoteRecipe of remoteRecipes) {
        if (!localIds.has(remoteRecipe.id)) {
          mergedRecipes.push(remoteRecipe);
          added++;
        }
      }

      // Save merged recipes locally
      this.saveCustomRecipes(mergedRecipes);

      // Push merged recipes to GitHub
      const saveResult = await client.saveRecipes(mergedRecipes, remoteResult.sha);
      
      if (!saveResult.success) {
        return { success: false, error: saveResult.error };
      }

      console.log(`✅ Sync complete: ${added} recipes added from GitHub`);

      return { success: true, added, updated: localRecipes.length };
    } catch (error) {
      console.error('Error syncing with GitHub:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Migrate existing localStorage recipes to GitHub (one-time setup)
   */
  static async migrateToGitHub(): Promise<{ success: boolean; count?: number; error?: string }> {
    const client = this.getGitHubClient();
    
    if (!client) {
      return { success: false, error: 'GitHub not configured' };
    }

    try {
      const localRecipes = this.loadCustomRecipes();
      
      if (localRecipes.length === 0) {
        return { success: true, count: 0 };
      }

      console.log(`📤 Migrating ${localRecipes.length} recipes to GitHub...`);

      // Check if recipes already exist on GitHub
      const remoteResult = await client.getRecipes();
      
      const result = await client.saveRecipes(localRecipes, remoteResult.sha);

      if (result.success) {
        console.log(`✅ Migrated ${localRecipes.length} recipes to GitHub`);
        return { success: true, count: localRecipes.length };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error migrating to GitHub:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}
