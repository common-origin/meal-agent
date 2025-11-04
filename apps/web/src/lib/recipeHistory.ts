/**
 * Recipe History Tracking
 * 
 * Tracks recently generated/used recipes to avoid repetition in AI generation.
 * Maintains a sliding window of the last 20 recipe IDs.
 */

import { Storage } from './storage';

const RECIPE_HISTORY_KEY = 'meal-agent:recipe-history:v1';
const MAX_HISTORY_SIZE = 20;

export interface RecipeHistoryEntry {
  recipeId: string;
  addedAt: string; // ISO date
  source: 'ai-generated' | 'selected-from-library';
}

export interface RecipeHistory {
  entries: RecipeHistoryEntry[];
  lastUpdated: string;
}

/**
 * Get the current recipe history
 */
export function getRecipeHistory(): RecipeHistory {
  const history = Storage.get<RecipeHistory>(RECIPE_HISTORY_KEY, {
    entries: [],
    lastUpdated: new Date().toISOString(),
  });
  
  return history;
}

/**
 * Add recipe IDs to history (e.g., after generating or selecting recipes)
 */
export function addToRecipeHistory(
  recipeIds: string[],
  source: 'ai-generated' | 'selected-from-library' = 'ai-generated'
): boolean {
  const history = getRecipeHistory();
  
  // Create new entries
  const newEntries: RecipeHistoryEntry[] = recipeIds.map(recipeId => ({
    recipeId,
    addedAt: new Date().toISOString(),
    source,
  }));
  
  // Combine with existing entries
  const allEntries = [...newEntries, ...history.entries];
  
  // Remove duplicates (keep most recent)
  const uniqueEntries = allEntries.reduce((acc, entry) => {
    const exists = acc.find(e => e.recipeId === entry.recipeId);
    if (!exists) {
      acc.push(entry);
    }
    return acc;
  }, [] as RecipeHistoryEntry[]);
  
  // Keep only the most recent MAX_HISTORY_SIZE entries
  const trimmedEntries = uniqueEntries.slice(0, MAX_HISTORY_SIZE);
  
  // Save updated history
  const updatedHistory: RecipeHistory = {
    entries: trimmedEntries,
    lastUpdated: new Date().toISOString(),
  };
  
  const success = Storage.set(RECIPE_HISTORY_KEY, updatedHistory);
  
  if (success) {
    console.log(`📚 Added ${recipeIds.length} recipes to history. Total tracked: ${trimmedEntries.length}`);
  }
  
  return success;
}

/**
 * Get recipe IDs to exclude from AI generation (recent recipes)
 */
export function getRecipeIdsToExclude(): string[] {
  const history = getRecipeHistory();
  return history.entries.map(entry => entry.recipeId);
}

/**
 * Get only AI-generated recipe IDs from history
 */
export function getAIGeneratedRecipeIds(): string[] {
  const history = getRecipeHistory();
  return history.entries
    .filter(entry => entry.source === 'ai-generated')
    .map(entry => entry.recipeId);
}

/**
 * Get history entries from the last N days
 */
export function getRecentHistory(days: number = 30): RecipeHistoryEntry[] {
  const history = getRecipeHistory();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return history.entries.filter(entry => {
    const entryDate = new Date(entry.addedAt);
    return entryDate >= cutoffDate;
  });
}

/**
 * Clear all recipe history
 */
export function clearRecipeHistory(): boolean {
  console.log('🗑️ Clearing recipe history');
  return Storage.remove(RECIPE_HISTORY_KEY);
}

/**
 * Get statistics about recipe history
 */
export function getRecipeHistoryStats() {
  const history = getRecipeHistory();
  const aiGenerated = history.entries.filter(e => e.source === 'ai-generated').length;
  const fromLibrary = history.entries.filter(e => e.source === 'selected-from-library').length;
  
  return {
    total: history.entries.length,
    aiGenerated,
    fromLibrary,
    oldestEntry: history.entries[history.entries.length - 1]?.addedAt,
    newestEntry: history.entries[0]?.addedAt,
    lastUpdated: history.lastUpdated,
  };
}
