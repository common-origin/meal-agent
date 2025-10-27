/**
 * Recency Tracker
 * Tracks recently used recipes to enforce variety (3-week window)
 */

import { REPETITION_WINDOW_WEEKS } from "./constants";

const STORAGE_KEY = "meal-agent:recipe-history";

export interface RecipeHistory {
  recipeId: string;
  weekOfISO: string; // ISO date of Monday
  usedAt: string; // ISO timestamp
}

/**
 * Get recipe history from localStorage
 */
export function getRecipeHistory(): RecipeHistory[] {
  if (typeof window === "undefined") return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as RecipeHistory[];
  } catch (error) {
    console.error("Failed to load recipe history:", error);
    return [];
  }
}

/**
 * Save recipe history to localStorage
 */
function saveRecipeHistory(history: RecipeHistory[]): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (error) {
    console.error("Failed to save recipe history:", error);
  }
}

/**
 * Add recipes from a week to history
 */
export function recordWeekRecipes(weekOfISO: string, recipeIds: string[]): void {
  const history = getRecipeHistory();
  const now = new Date().toISOString();
  
  // Add new entries
  const newEntries: RecipeHistory[] = recipeIds.map(recipeId => ({
    recipeId,
    weekOfISO,
    usedAt: now
  }));
  
  // Combine and deduplicate (keep most recent)
  const combined = [...history, ...newEntries];
  const deduplicated = deduplicateHistory(combined);
  
  // Prune old entries (beyond repetition window)
  const pruned = pruneOldHistory(deduplicated);
  
  saveRecipeHistory(pruned);
}

/**
 * Get recipes used within the repetition window
 */
export function getRecentRecipeIds(currentWeekISO?: string): string[] {
  const history = getRecipeHistory();
  const pruned = pruneOldHistory(history, currentWeekISO);
  
  // Return unique recipe IDs
  return Array.from(new Set(pruned.map(h => h.recipeId)));
}

/**
 * Check if a recipe was used recently (within window)
 */
export function wasRecentlyUsed(recipeId: string, currentWeekISO?: string): boolean {
  const recentIds = getRecentRecipeIds(currentWeekISO);
  return recentIds.includes(recipeId);
}

/**
 * Remove entries older than repetition window
 */
function pruneOldHistory(
  history: RecipeHistory[],
  currentWeekISO?: string
): RecipeHistory[] {
  const referenceDate = currentWeekISO 
    ? new Date(currentWeekISO)
    : new Date();
  
  const windowStartDate = new Date(referenceDate);
  windowStartDate.setDate(windowStartDate.getDate() - (REPETITION_WINDOW_WEEKS * 7));
  
  return history.filter(entry => {
    const entryDate = new Date(entry.weekOfISO);
    return entryDate >= windowStartDate;
  });
}

/**
 * Deduplicate history - keep most recent entry per recipe+week combo
 */
function deduplicateHistory(history: RecipeHistory[]): RecipeHistory[] {
  const map = new Map<string, RecipeHistory>();
  
  for (const entry of history) {
    const key = `${entry.recipeId}:${entry.weekOfISO}`;
    const existing = map.get(key);
    
    if (!existing || entry.usedAt > existing.usedAt) {
      map.set(key, entry);
    }
  }
  
  return Array.from(map.values());
}

/**
 * Clear all history (for testing/reset)
 */
export function clearRecipeHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Get usage count for each recipe in history
 */
export function getRecipeUsageCounts(): Record<string, number> {
  const history = getRecipeHistory();
  const counts: Record<string, number> = {};
  
  for (const entry of history) {
    counts[entry.recipeId] = (counts[entry.recipeId] || 0) + 1;
  }
  
  return counts;
}
