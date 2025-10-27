// Simple localStorage wrapper with error handling
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