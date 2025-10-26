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
  ANALYTICS: "meal-agent-analytics"
} as const;