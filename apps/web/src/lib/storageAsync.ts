/**
 * Async Storage Wrappers
 * 
 * This module provides async versions of storage functions that automatically
 * use Supabase for authenticated users and localStorage for unauthenticated users.
 * 
 * Components should migrate from './storage' to './storageAsync' to enable
 * multi-account functionality with proper data isolation.
 */

import * as HybridStorage from './hybridStorage';
import * as LocalStorage from './storage';
import type { FamilySettings } from './types/settings';
import type { StoredWeekPlan } from './storage';

/**
 * Re-export types and constants that don't need async behavior
 */
export { Storage, STORAGE_KEYS, getDefaultHousehold } from './storage';
export type { StoredWeekPlan, RecipeRating } from './storage';

/**
 * Family Settings - Async versions
 */
export async function saveFamilySettings(settings: FamilySettings): Promise<boolean> {
  return await HybridStorage.saveFamilySettings(settings);
}

export async function loadFamilySettings(): Promise<FamilySettings | null> {
  return await HybridStorage.loadFamilySettings();
}

export async function getFamilySettings(): Promise<FamilySettings> {
  return await HybridStorage.getFamilySettings();
}

export async function updateFamilySettings(partial: Partial<FamilySettings>): Promise<boolean> {
  const current = await getFamilySettings();
  const updated = {
    ...current,
    ...partial,
    lastUpdated: new Date().toISOString(),
  };
  return await saveFamilySettings(updated);
}

export async function resetFamilySettings(): Promise<boolean> {
  const { DEFAULT_FAMILY_SETTINGS } = await import('./types/settings');
  return await saveFamilySettings(DEFAULT_FAMILY_SETTINGS);
}

/**
 * Current Week Plan - Async versions
 * 
 * Note: These adapt between localStorage's array-based format
 * and Supabase's object-based format
 */
export async function saveCurrentWeekPlan(
  recipeIds: string[],
  weekOfISO: string,
  pantryItems?: string[]
): Promise<boolean> {
  // Convert array format to object format for HybridStorage
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const meals: Record<string, { recipeId: string; servings?: number } | null> = {};
  
  recipeIds.forEach((id, index) => {
    if (index < days.length) {
      meals[days[index]] = id ? { recipeId: id } : null;
    }
  });
  
  const success = await HybridStorage.saveMealPlan(weekOfISO, meals);
  
  // Also save pantry items if provided
  if (success && pantryItems) {
    await HybridStorage.savePantryItems(pantryItems);
  }
  
  return success;
}

export async function loadCurrentWeekPlan(weekOfISO: string): Promise<StoredWeekPlan | null> {
  if (!weekOfISO) {
    return null;
  }
  
  const plan = await HybridStorage.loadMealPlan(weekOfISO);
  if (!plan) return null;
  
  // Convert object format back to array format
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const recipeIds = days.map(day => plan.meals[day]?.recipeId || '');
  
  // Load pantry items
  const pantryItems = await HybridStorage.loadPantryItems();
  
  return {
    recipeIds,
    weekOfISO: plan.weekStart,
    createdAt: new Date().toISOString(),
    pantryItems: pantryItems.length > 0 ? pantryItems : undefined,
  };
}

export async function clearCurrentWeekPlan(): Promise<boolean> {
  // For now, just use localStorage clear
  // TODO: Implement Supabase clearing when we have a better understanding of the use case
  return LocalStorage.clearCurrentWeekPlan();
}

/**
 * Household and Favorites
 * 
 * These remain localStorage-only for now as they're not part of the
 * initial Supabase schema. They will be migrated in a future iteration.
 */
export const { 
  saveHousehold,
  loadHousehold,
  toggleFavorite,
  isFavorite,
  getFavorites,
} = LocalStorage;

/**
 * Recipe Ratings and Blocking
 * 
 * These remain localStorage-only for now. They could be moved to Supabase
 * in the future for cross-device sync.
 */
export const {
  getRecipeRatings,
  saveRecipeRating,
  getRecipeRating,
  blockRecipe,
  unblockRecipe,
  isRecipeBlocked,
  getBlockedRecipes,
} = LocalStorage;

/**
 * Weekly Overrides
 * 
 * These remain localStorage-only for now.
 */
export const {
  saveWeeklyOverrides,
  loadWeeklyOverrides,
} = LocalStorage;
