/**
 * Hybrid Storage Layer
 * 
 * Uses Supabase when user is authenticated, falls back to localStorage otherwise.
 * This allows gradual migration and maintains offline capability.
 */

import * as LocalStorage from './storage';
import * as SupabaseStorage from './supabaseStorage';
import { getCurrentUser } from './supabase/client';
import type { FamilySettings } from './types/settings';
import { DEFAULT_FAMILY_SETTINGS } from './types/settings';
import type { Recipe } from './types/recipe';
import type { StoredWeekPlan } from './storage';
import { RecipeLibrary } from './library';
import { loadPantryPreferences, savePantryPreferences } from './pantryPreferences';

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/**
 * Check if user is authenticated
 */
async function isAuthenticated(): Promise<boolean> {
  try {
    const user = await getCurrentUser();
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
 * getFamilySettings, plus whether a signed-in household has never saved its
 * settings and so needs first-run setup (#211). One load serves both.
 */
export async function getFamilySettingsAndSetup(): Promise<{ settings: FamilySettings; needsSetup: boolean }> {
  if (await isAuthenticated()) {
    const { settings, needsSetup } = await SupabaseStorage.loadFamilySettingsStateFromDb();
    if (settings) return { settings, needsSetup };
  }
  return { settings: LocalStorage.loadFamilySettings() ?? LocalStorage.getFamilySettings(), needsSetup: false };
}

export async function resetFamilySettings(): Promise<boolean> {
  return await saveFamilySettings(DEFAULT_FAMILY_SETTINGS);
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
    const days = DAYS_OF_WEEK.map(day => meals[day]);
    return LocalStorage.saveCurrentWeekPlan(
      days.map(m => m?.recipeId || ''),
      weekStart,
      undefined,
      days.map(m => m?.reason || '')
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

    localPlan.recipeIds.forEach((recipeId, index) => {
      if (recipeId) {
        const reason = localPlan.reasons?.[index];
        meals[DAYS_OF_WEEK[index]] = reason ? { recipeId, reason } : { recipeId };
      } else {
        meals[DAYS_OF_WEEK[index]] = null;
      }
    });
    
    return {
      weekStart: localPlan.weekOfISO,
      meals,
    };
  }
}

/**
 * The household's planned weeks from `fromISO` on (#194). Signed out, that's
 * the one plan localStorage keeps, if it's in range.
 */
export async function listPlannedWeeks(fromISO: string): Promise<string[]> {
  if (await isAuthenticated()) {
    return SupabaseStorage.listMealPlanWeeks(fromISO);
  }
  const week = LocalStorage.loadSavedPlanWeek();
  return week && week >= fromISO ? [week] : [];
}

/**
 * Current Week Plan
 *
 * Adapts between the plan/shopping-list pages' array-based day format and
 * saveMealPlan/loadMealPlan's object-keyed-by-day format above.
 */
export async function saveCurrentWeekPlan(
  recipeIds: string[],
  weekOfISO: string,
  pantryItems?: string[],
  /** Per day, why the AI chose that meal (#94); '' or missing where there's none. */
  reasons?: string[]
): Promise<boolean> {
  const meals: SupabaseStorage.MealPlan['meals'] = {};

  recipeIds.forEach((id, index) => {
    if (index < DAYS_OF_WEEK.length) {
      const reason = reasons?.[index];
      meals[DAYS_OF_WEEK[index]] = id ? { recipeId: id, ...(reason ? { reason } : {}) } : null;
    }
  });

  const success = await saveMealPlan(weekOfISO, meals);

  if (success && pantryItems) {
    await savePantryItems(pantryItems);
  }

  return success;
}

export async function loadCurrentWeekPlan(weekOfISO: string): Promise<StoredWeekPlan | null> {
  if (!weekOfISO) {
    return null;
  }

  const plan = await loadMealPlan(weekOfISO);
  if (!plan) return null;

  const recipeIds = DAYS_OF_WEEK.map(day => plan.meals[day]?.recipeId || '');
  // Older plans have no reasons; '' keeps the array aligned with recipeIds.
  const reasons = DAYS_OF_WEEK.map(day => plan.meals[day]?.reason || '');

  const pantryItems = await loadPantryItems();

  return {
    recipeIds,
    weekOfISO: plan.weekStart,
    createdAt: new Date().toISOString(),
    pantryItems: pantryItems.length > 0 ? pantryItems : undefined,
    reasons,
  };
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

export async function deleteRecipe(recipeId: string): Promise<boolean> {
  const authed = await isAuthenticated();
  
  if (authed) {
    return await SupabaseStorage.deleteRecipe(recipeId);
  } else {
    // For localStorage, recipes are managed by RecipeLibrary
    return true;
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
    // items === [] is a confirmed-empty cloud row, not "no data" — respect
    // it rather than falling back to a possibly-stale local cache. Only
    // null (no household/row/query failure) falls through below.
    if (items !== null) {
      // Keep the localStorage cache in sync so synchronous local-only
      // readers (e.g. shoppingListAggregator.ts's isInPantryPreferences)
      // see this device's latest data right after hydration, rather than
      // whatever was last written on this device specifically.
      savePantryPreferences(new Set(items));
      return items;
    }
  }

  // Fall back to localStorage
  return Array.from(loadPantryPreferences());
}

/**
 * Recipe History (recency tracking)
 *
 * compose.ts's composeWeek() stays synchronous and keeps recording directly
 * to recencyTracker.ts's localStorage cache (unchanged behavior) — these
 * two functions bookend that call for authenticated users instead of
 * threading an auth-aware call through composeWeek itself, which would
 * force it (and getSuggestedSwaps, and every synchronous caller/test) async
 * for no behavior change. Call hydrateRecencyFromSupabase before composing
 * a week so cross-device history is available locally, and
 * syncRecencyToSupabase after so this week's picks reach other devices.
 */
export async function hydrateRecencyFromSupabase(): Promise<void> {
  const authed = await isAuthenticated();
  if (!authed) return;

  // Only fetch what pruneOldHistory would keep anyway (REPETITION_WINDOW_WEEKS)
  // rather than the household's entire history table.
  const { REPETITION_WINDOW_WEEKS } = await import('./constants');
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - REPETITION_WINDOW_WEEKS * 7);
  const sinceISO = sinceDate.toISOString().split('T')[0];

  const entries = await SupabaseStorage.loadRecipeHistory(sinceISO);
  const { mergeRemoteHistory } = await import('./recencyTracker');
  mergeRemoteHistory(entries.map(e => ({
    recipeId: e.recipeId,
    weekOfISO: e.weekStart,
    usedAt: e.usedAt,
  })));
}

/**
 * Record recipes the AI added to a week: locally for this device's next
 * prompt, and in recipe_history for the household's other devices (#88).
 */
export async function recordWeekHistory(weekOfISO: string, recipeIds: string[]): Promise<void> {
  const { recordWeekRecipes } = await import('./recencyTracker');
  recordWeekRecipes(weekOfISO, recipeIds);
  await syncRecencyToSupabase(weekOfISO, recipeIds);
}

export async function syncRecencyToSupabase(weekOfISO: string, recipeIds: string[]): Promise<void> {
  const authed = await isAuthenticated();
  if (!authed) return;

  const usedAt = new Date().toISOString();
  // Dedupe: composeWeek() deliberately repeats a recipeId across a
  // bulk-cook leftover day, and the upsert's (household_id, recipe_id,
  // week_start) conflict key can't appear twice in one statement — Postgres
  // rejects the whole upsert ("ON CONFLICT DO UPDATE command cannot affect
  // row a second time") if it does.
  const uniqueRecipeIds = new Set(recipeIds.filter((id): id is string => Boolean(id)));
  const entries = Array.from(uniqueRecipeIds).map(recipeId => ({ recipeId, weekStart: weekOfISO, usedAt }));

  if (entries.length === 0) return;

  await SupabaseStorage.saveRecipeHistoryEntries(entries);
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
      console.log('Migrating family settings:', familySettings);
      const success = await SupabaseStorage.saveFamilySettingsToDb(familySettings);
      if (!success) {
        console.error('Failed to migrate family settings');
        errors.push('Failed to migrate family settings');
      } else {
        console.log('✓ Migrated family settings');
      }
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

      currentWeekPlan.recipeIds.forEach((recipeId, index) => {
        if (recipeId) {
          meals[DAYS_OF_WEEK[index]] = { recipeId };
        } else {
          meals[DAYS_OF_WEEK[index]] = null;
        }
      });
      
      const success = await SupabaseStorage.saveMealPlan({
        weekStart: currentWeekPlan.weekOfISO,
        meals,
      });
      if (!success) errors.push('Failed to migrate meal plan');
      else console.log('✓ Migrated current week meal plan');
    }
    
    // Migrate only custom recipes (not built-in library recipes)
    const customRecipes = RecipeLibrary.getCustomRecipes();
    let recipeMigrated = 0;
    let recipeFailed = 0;
    
    if (customRecipes.length > 0) {
      console.log(`Migrating ${customRecipes.length} custom recipes...`);
      for (const recipe of customRecipes) {
        try {
          console.log('Attempting to migrate recipe:', recipe.id, recipe.title);
          const success = await SupabaseStorage.saveRecipe(recipe);
          if (success) {
            recipeMigrated++;
          } else {
            console.error('Failed to migrate recipe:', recipe.id, recipe.title);
            console.error('Recipe data:', recipe);
            recipeFailed++;
          }
        } catch (err) {
          console.error('Exception migrating recipe:', recipe.id, recipe.title, err);
          recipeFailed++;
        }
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

/**
 * Favourites (#222)
 *
 * household_favorites in Supabase is the source of truth; localStorage
 * (lib/storage.ts) is the synchronous cache everything reads.
 */

const FAVORITES_SYNCED_PREFIX = 'meal-agent:favorites-synced:';

/**
 * Toggles not yet confirmed by Supabase: recipeId → favourite or not. Kept
 * in localStorage so a refresh can't undo a toggle whose write is still in
 * flight, and a failed write is retried rather than lost.
 */
function readPendingFavorites(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(LocalStorage.FAVORITES_PENDING_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function writePendingFavorites(pending: Record<string, boolean>): void {
  try {
    if (Object.keys(pending).length === 0) localStorage.removeItem(LocalStorage.FAVORITES_PENDING_KEY);
    else localStorage.setItem(LocalStorage.FAVORITES_PENDING_KEY, JSON.stringify(pending));
  } catch {
    // Storage blocked: the toggle is still sent; it just can't be retried.
  }
}

/** Sends one pending toggle; clears it once confirmed, unless it was toggled again meanwhile. */
async function pushPendingFavorite(recipeId: string, favorite: boolean): Promise<boolean> {
  const ok = favorite
    ? await SupabaseStorage.addFavoritesToDb([recipeId])
    : await SupabaseStorage.removeFavoriteFromDb(recipeId);
  if (ok) {
    const pending = readPendingFavorites();
    if (pending[recipeId] === favorite) {
      delete pending[recipeId];
      writePendingFavorites(pending);
    }
  }
  return ok;
}

/**
 * Toggles a favourite: in the local cache now (as before), then in Supabase
 * in the background. Returns whether it's now a favourite. Until Supabase
 * confirms it, the toggle stays pending: a refresh keeps it, and retries it
 * if the write failed.
 */
export function toggleFavorite(recipeId: string): boolean {
  LocalStorage.toggleFavorite(recipeId);
  const nowFavorite = LocalStorage.isFavorite(recipeId);
  // Recorded before any await, so a refresh that resolves meanwhile keeps it.
  writePendingFavorites({ ...readPendingFavorites(), [recipeId]: nowFavorite });
  void (async () => {
    // Signed out: it stays pending and goes up with the next signed-in refresh.
    if (!(await isAuthenticated())) return;
    if (!(await pushPendingFavorite(recipeId, nowFavorite))) {
      console.warn(`Could not ${nowFavorite ? 'save' : 'remove'} favourite ${recipeId} for the household; will retry`);
    }
  })();
  return nowFavorite;
}

/**
 * Loads the household's favourites into the local cache and returns them.
 * The first time this device syncs a household, favourites it has locally
 * but the server doesn't are uploaded and kept; after that the server wins,
 * so removals elsewhere carry over, except for this device's toggles that
 * Supabase hasn't confirmed yet, which are applied on top and retried.
 * Signed out, or when Supabase can't be read, the local list is returned
 * unchanged.
 */
export async function hydrateFavoritesFromSupabase(): Promise<string[]> {
  if (!(await isAuthenticated())) return LocalStorage.getFavorites();

  // Reading the server first also clears a cache left from another household (#217).
  const remote = await SupabaseStorage.loadFavoritesFromDb();
  if (!remote) return LocalStorage.getFavorites();

  const syncedKey = `${FAVORITES_SYNCED_PREFIX}${remote.householdId}`;
  let firstSync = false;
  try {
    firstSync = localStorage.getItem(syncedKey) === null;
  } catch {
    firstSync = false;
  }

  let favorites = remote.recipeIds;
  if (firstSync) {
    const localOnly = LocalStorage.getFavorites().filter(id => !remote.recipeIds.includes(id));
    if (localOnly.length > 0) {
      if (!(await SupabaseStorage.addFavoritesToDb(localOnly))) {
        // Keep them locally and try the upload again next time.
        return [...new Set([...remote.recipeIds, ...LocalStorage.getFavorites()])];
      }
      favorites = [...remote.recipeIds, ...localOnly];
    }
    try {
      localStorage.setItem(syncedKey, new Date().toISOString());
    } catch {
      // Storage blocked: the upload just runs again next time, harmlessly.
    }
  }

  // This device's unconfirmed toggles win over what the server returned: an
  // in-flight one would otherwise be undone, and a failed one gets retried.
  const pending = readPendingFavorites();
  for (const [recipeId, favorite] of Object.entries(pending)) {
    favorites = favorite
      ? (favorites.includes(recipeId) ? favorites : [...favorites, recipeId])
      : favorites.filter(id => id !== recipeId);
  }
  LocalStorage.setFavorites(favorites);
  await Promise.all(Object.entries(pending).map(([recipeId, favorite]) => pushPendingFavorite(recipeId, favorite)));
  return favorites;
}
