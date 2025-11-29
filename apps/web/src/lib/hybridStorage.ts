/**
 * Hybrid Storage Layer
 * 
 * Uses Supabase when user is authenticated, falls back to localStorage otherwise.
 * This allows gradual migration and maintains offline capability.
 */

import * as LocalStorage from './storage';
import * as SupabaseStorage from './supabaseStorage';
import { createClient } from './supabase/client';
import type { FamilySettings } from './types/settings';
import type { Recipe } from './types/recipe';
import { RecipeLibrary } from './library';
import { loadPantryPreferences, savePantryPreferences } from './pantryPreferences';

/**
 * Check if user is authenticated
 */
async function isAuthenticated(): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return !!user;
  } catch {
    return false;
  }
}

/**
 * Family Settings
 */
export async function saveFamilySettings(settings: FamilySettings): Promise<boolean> {
  const authed = await isAuthenticated();
  
  if (authed) {
    // Save to Supabase
    const success = await SupabaseStorage.saveFamilySettingsToDb(settings);
    // Also save to localStorage as backup
    LocalStorage.saveFamilySettings(settings);
    return success;
  } else {
    // Save to localStorage only
    return LocalStorage.saveFamilySettings(settings);
  }
}

export async function loadFamilySettings(): Promise<FamilySettings | null> {
  const authed = await isAuthenticated();
  
  if (authed) {
    // Load from Supabase
    const settings = await SupabaseStorage.loadFamilySettingsFromDb();
    if (settings) return settings;
  }
  
  // Fall back to localStorage
  return LocalStorage.loadFamilySettings();
}

export async function getFamilySettings(): Promise<FamilySettings> {
  const settings = await loadFamilySettings();
  if (settings) return settings;
  
  // Return defaults if nothing found
  return LocalStorage.getFamilySettings();
}

/**
 * Meal Plans
 */
export async function saveMealPlan(
  weekStart: string,
  meals: SupabaseStorage.MealPlan['meals']
): Promise<boolean> {
  const authed = await isAuthenticated();
  
  if (authed) {
    return await SupabaseStorage.saveMealPlan({ weekStart, meals });
  } else {
    // For localStorage, we'll use the existing structure
    // This is a simplified version - you may need to adapt based on your current implementation
    return LocalStorage.saveCurrentWeekPlan(
      Object.values(meals).map(m => m?.recipeId || ''),
      weekStart
    );
  }
}

export async function loadMealPlan(weekStart: string): Promise<SupabaseStorage.MealPlan | null> {
  const authed = await isAuthenticated();
  
  if (authed) {
    return await SupabaseStorage.loadMealPlan(weekStart);
  } else {
    // Load from localStorage
    const localPlan = LocalStorage.loadCurrentWeekPlan(weekStart);
    if (!localPlan) return null;
    
    // Convert localStorage format to MealPlan format
    const meals: SupabaseStorage.MealPlan['meals'] = {};
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    localPlan.recipeIds.forEach((recipeId, index) => {
      if (recipeId) {
        meals[days[index]] = { recipeId };
      } else {
        meals[days[index]] = null;
      }
    });
    
    return {
      weekStart: localPlan.weekOfISO,
      meals,
    };
  }
}

/**
 * Recipes
 */
export async function saveRecipe(recipe: Recipe): Promise<boolean> {
  const authed = await isAuthenticated();
  
  if (authed) {
    return await SupabaseStorage.saveRecipe(recipe);
  } else {
    // For localStorage, recipes are managed by RecipeLibrary
    // This is a pass-through for now
    return true;
  }
}

export async function loadRecipe(recipeId: string): Promise<Recipe | null> {
  const authed = await isAuthenticated();
  
  if (authed) {
    return await SupabaseStorage.loadRecipe(recipeId);
  } else {
    // Load from RecipeLibrary (localStorage)
    return RecipeLibrary.getById(recipeId) || null;
  }
}

export async function loadAllRecipes(): Promise<Recipe[]> {
  const authed = await isAuthenticated();
  
  if (authed) {
    return await SupabaseStorage.loadAllRecipes();
  } else {
    // Load from RecipeLibrary (localStorage)
    return RecipeLibrary.getAll();
  }
}

/**
 * Shopping Lists
 */
export async function saveShoppingList(list: SupabaseStorage.ShoppingList): Promise<boolean> {
  const authed = await isAuthenticated();
  
  if (authed) {
    return await SupabaseStorage.saveShoppingList(list);
  } else {
    // For localStorage, we'd need to implement this
    // For now, return true as shopping lists are handled differently
    return true;
  }
}

export async function loadShoppingList(weekStart: string): Promise<SupabaseStorage.ShoppingList | null> {
  const authed = await isAuthenticated();
  
  if (authed) {
    return await SupabaseStorage.loadShoppingList(weekStart);
  } else {
    // Load from localStorage if implemented
    return null;
  }
}

/**
 * Pantry Preferences
 */
export async function savePantryItems(items: string[]): Promise<boolean> {
  const authed = await isAuthenticated();
  
  if (authed) {
    const success = await SupabaseStorage.savePantryItems(items);
    // Also update localStorage pantry preferences
    savePantryPreferences(new Set(items));
    return success;
  } else {
    // Save to localStorage
    savePantryPreferences(new Set(items));
    return true;
  }
}

export async function loadPantryItems(): Promise<string[]> {
  const authed = await isAuthenticated();
  
  if (authed) {
    const items = await SupabaseStorage.loadPantryItems();
    if (items.length > 0) return items;
  }
  
  // Fall back to localStorage
  return Array.from(loadPantryPreferences());
}

/**
 * Migration Helper
 * 
 * Migrates all localStorage data to Supabase for an authenticated user
 */
export async function migrateLocalStorageToSupabase(): Promise<{
  success: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  
  try {
    const authed = await isAuthenticated();
    if (!authed) {
      errors.push('User not authenticated');
      return { success: false, errors };
    }
    
    console.log('Starting migration from localStorage to Supabase...');
    
    // Migrate family settings
    const familySettings = LocalStorage.loadFamilySettings();
    if (familySettings) {
      const success = await SupabaseStorage.saveFamilySettingsToDb(familySettings);
      if (!success) errors.push('Failed to migrate family settings');
      else console.log('✓ Migrated family settings');
    }
    
    // Migrate pantry preferences
    const pantryItems = Array.from(loadPantryPreferences()) as string[];
    if (pantryItems.length > 0) {
      const success = await SupabaseStorage.savePantryItems(pantryItems);
      if (!success) errors.push('Failed to migrate pantry preferences');
      else console.log('✓ Migrated pantry preferences');
    }
    
    // Migrate current week plan if exists
    const currentWeekPlan = LocalStorage.loadCurrentWeekPlan(
      new Date().toISOString().split('T')[0]
    );
    if (currentWeekPlan) {
      const meals: SupabaseStorage.MealPlan['meals'] = {};
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      
      currentWeekPlan.recipeIds.forEach((recipeId, index) => {
        if (recipeId) {
          meals[days[index]] = { recipeId };
        } else {
          meals[days[index]] = null;
        }
      });
      
      const success = await SupabaseStorage.saveMealPlan({
        weekStart: currentWeekPlan.weekOfISO,
        meals,
      });
      if (!success) errors.push('Failed to migrate meal plan');
      else console.log('✓ Migrated current week meal plan');
    }
    
    // Migrate recipes from RecipeLibrary
    const recipes = RecipeLibrary.getAll();
    let recipeMigrated = 0;
    let recipeFailed = 0;
    
    for (const recipe of recipes) {
      const success = await SupabaseStorage.saveRecipe(recipe);
      if (success) {
        recipeMigrated++;
      } else {
        recipeFailed++;
      }
    }
    
    if (recipeMigrated > 0) {
      console.log(`✓ Migrated ${recipeMigrated} recipes`);
    }
    if (recipeFailed > 0) {
      errors.push(`Failed to migrate ${recipeFailed} recipes`);
    }
    
    console.log('Migration complete!');
    
    return {
      success: errors.length === 0,
      errors,
    };
  } catch (error) {
    console.error('Migration error:', error);
    errors.push(error instanceof Error ? error.message : 'Unknown error');
    return { success: false, errors };
  }
}
