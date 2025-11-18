// Simple localStorage wrapper with error handling
import type { FamilySettings } from "./types/settings";
import { DEFAULT_FAMILY_SETTINGS } from "./types/settings";

export class Storage {
  static get<T>(key: string, defaultValue: T): T {
    if (typeof window === "undefined") {
      return defaultValue;
    }
    
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.warn(`Failed to get item from localStorage: ${key}`, error);
      return defaultValue;
    }
  }
  
  static set<T>(key: string, value: T): boolean {
    if (typeof window === "undefined") {
      return false;
    }
    
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn(`Failed to set item in localStorage: ${key}`, error);
      return false;
    }
  }
  
  static remove(key: string): boolean {
    if (typeof window === "undefined") {
      return false;
    }
    
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn(`Failed to remove item from localStorage: ${key}`, error);
      return false;
    }
  }
  
  static clear(): boolean {
    if (typeof window === "undefined") {
      return false;
    }
    
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.warn("Failed to clear localStorage", error);
      return false;
    }
  }
}

// Meal Agent specific storage keys
export const STORAGE_KEYS = {
  WEEK_PLAN: "meal-agent-week-plan",
  BUDGET: "meal-agent-budget", 
  USER_PREFERENCES: "meal-agent-preferences",
  ANALYTICS: "meal-agent-analytics",
  HOUSEHOLD: "ma_household",
  OVERRIDES_PREFIX: "ma_overrides:", // followed by weekOfISO
} as const;

// Type imports
import type { WeeklyOverrides, Household } from "./types/recipe";

// Weekly Overrides helpers
export function saveWeeklyOverrides(overrides: WeeklyOverrides): boolean {
  const key = `${STORAGE_KEYS.OVERRIDES_PREFIX}${overrides.weekOfISO}`;
  return Storage.set(key, overrides);
}

export function loadWeeklyOverrides(weekOfISO: string): WeeklyOverrides | null {
  const key = `${STORAGE_KEYS.OVERRIDES_PREFIX}${weekOfISO}`;
  return Storage.get<WeeklyOverrides | null>(key, null);
}

// Household helpers
export function saveHousehold(household: Household): boolean {
  return Storage.set(STORAGE_KEYS.HOUSEHOLD, household);
}

export function loadHousehold(): Household | null {
  return Storage.get<Household | null>(STORAGE_KEYS.HOUSEHOLD, null);
}

export function getDefaultHousehold(): Household {
  return {
    id: "default",
    members: { adults: 2, kids: 2 },
    diet: { glutenLight: false, highProtein: false, organicPreferred: false },
    retailer: "coles",
    pantry: [],
    favorites: []
  };
}

// Favorites helpers
export function toggleFavorite(recipeId: string): boolean {
  const household = loadHousehold() || getDefaultHousehold();
  const index = household.favorites.indexOf(recipeId);
  
  if (index > -1) {
    // Remove from favorites
    household.favorites.splice(index, 1);
  } else {
    // Add to favorites
    household.favorites.push(recipeId);
    
    // If this is a temporary AI recipe, promote it to permanent custom recipe
    // This is lazy-loaded to avoid circular dependency
    const { RecipeLibrary } = require('./library');
    RecipeLibrary.promoteTempAIRecipeToCustom(recipeId);
  }
  
  return saveHousehold(household);
}

export function isFavorite(recipeId: string): boolean {
  const household = loadHousehold() || getDefaultHousehold();
  return household.favorites.includes(recipeId);
}

export function getFavorites(): string[] {
  const household = loadHousehold() || getDefaultHousehold();
  return household.favorites;
}

// ============================================
// Family Settings (for AI meal generation)
// ============================================

const FAMILY_SETTINGS_KEY = "meal-agent:family-settings:v1";

/**
 * Save family settings to localStorage
 */
export function saveFamilySettings(settings: FamilySettings): boolean {
  return Storage.set(FAMILY_SETTINGS_KEY, {
    ...settings,
    lastUpdated: new Date().toISOString(),
  });
}

/**
 * Load family settings from localStorage
 */
export function loadFamilySettings(): FamilySettings | null {
  const settings = Storage.get<FamilySettings | null>(FAMILY_SETTINGS_KEY, null);
  return settings;
}

/**
 * Get family settings with defaults if not set
 * Merges loaded settings with defaults to ensure new fields exist
 */
export function getFamilySettings(): FamilySettings {
  const loaded = loadFamilySettings();
  
  if (!loaded) {
    return DEFAULT_FAMILY_SETTINGS;
  }
  
  // Deep merge to ensure all new fields have defaults
  return {
    ...DEFAULT_FAMILY_SETTINGS,
    ...loaded,
    // Ensure nested objects have defaults
    location: {
      ...DEFAULT_FAMILY_SETTINGS.location,
      ...(loaded.location || {}),
    },
    budgetPerMeal: {
      ...DEFAULT_FAMILY_SETTINGS.budgetPerMeal,
      ...(loaded.budgetPerMeal || {}),
    },
    maxCookTime: {
      ...DEFAULT_FAMILY_SETTINGS.maxCookTime,
      ...(loaded.maxCookTime || {}),
    },
    batchCooking: {
      ...DEFAULT_FAMILY_SETTINGS.batchCooking,
      ...(loaded.batchCooking || {}),
    },
  };
}

/**
 * Reset family settings to defaults
 */
export function resetFamilySettings(): boolean {
  return saveFamilySettings(DEFAULT_FAMILY_SETTINGS);
}

/**
 * Update specific family settings fields
 */
export function updateFamilySettings(partial: Partial<FamilySettings>): boolean {
  const current = getFamilySettings();
  const updated = {
    ...current,
    ...partial,
    lastUpdated: new Date().toISOString(),
  };
  return saveFamilySettings(updated);
}

// ============================================
// Current Week Plan Storage
// ============================================

const CURRENT_WEEK_PLAN_KEY = "meal-agent:current-week-plan:v1";

export interface StoredWeekPlan {
  recipeIds: string[]; // 7 recipe IDs (or empty string for null)
  weekOfISO: string;
  createdAt: string;
  pantryItems?: string[]; // Items in pantry/fridge for this week
}

/**
 * Save current week plan (from plan page)
 */
export function saveCurrentWeekPlan(recipeIds: string[], weekOfISO: string, pantryItems?: string[]): boolean {
  const plan: StoredWeekPlan = {
    recipeIds,
    weekOfISO,
    createdAt: new Date().toISOString(),
    pantryItems,
  };
  return Storage.set(CURRENT_WEEK_PLAN_KEY, plan);
}

/**
 * Load current week plan
 */
export function loadCurrentWeekPlan(weekOfISO: string): StoredWeekPlan | null {
  const plan = Storage.get<StoredWeekPlan | null>(CURRENT_WEEK_PLAN_KEY, null);
  
  // Only return if it's for the same week
  if (plan && plan.weekOfISO === weekOfISO) {
    return plan;
  }
  
  return null;
}

/**
 * Clear current week plan
 */
export function clearCurrentWeekPlan(): boolean {
  return Storage.remove(CURRENT_WEEK_PLAN_KEY);
}
