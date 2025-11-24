/**
 * User Pantry Preferences
 * Manages user's preferences for which ingredients they always have in their pantry
 * These items will be excluded from the shopping list (moved to "Already Have" section)
 */

const STORAGE_KEY = 'user_pantry_preferences';

/**
 * Load user's pantry item preferences from localStorage
 * Returns a Set of normalized ingredient names
 */
export function loadPantryPreferences(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return new Set();
    
    const array = JSON.parse(stored) as string[];
    return new Set(array);
  } catch (error) {
    console.error('Failed to load pantry preferences:', error);
    return new Set();
  }
}

/**
 * Save user's pantry item preferences to localStorage
 */
export function savePantryPreferences(preferences: Set<string>): void {
  if (typeof window === 'undefined') return;
  
  try {
    const array = Array.from(preferences);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(array));
    console.log('✅ Saved pantry preferences:', array.length, 'items');
  } catch (error) {
    console.error('Failed to save pantry preferences:', error);
  }
}

/**
 * Add an ingredient to pantry preferences
 */
export function addToPantryPreferences(normalizedName: string): void {
  const preferences = loadPantryPreferences();
  preferences.add(normalizedName.toLowerCase().trim());
  savePantryPreferences(preferences);
}

/**
 * Remove an ingredient from pantry preferences
 */
export function removeFromPantryPreferences(normalizedName: string): void {
  const preferences = loadPantryPreferences();
  preferences.delete(normalizedName.toLowerCase().trim());
  savePantryPreferences(preferences);
}

/**
 * Check if an ingredient is in pantry preferences
 */
export function isInPantryPreferences(normalizedName: string): boolean {
  const preferences = loadPantryPreferences();
  return preferences.has(normalizedName.toLowerCase().trim());
}

/**
 * Clear all pantry preferences
 */
export function clearPantryPreferences(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Get count of pantry preferences
 */
export function getPantryPreferencesCount(): number {
  return loadPantryPreferences().size;
}

/**
 * Export pantry preferences as array for debugging/display
 */
export function exportPantryPreferences(): string[] {
  return Array.from(loadPantryPreferences()).sort();
}
