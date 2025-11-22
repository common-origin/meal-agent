/**
 * Ingredient Analytics
 * 
 * Tracks ingredient usage frequency across meal plans to identify:
 * - Most commonly used ingredients
 * - Unmapped ingredients that need pricing data
 * - Priority list for expanding colesMapping.ts
 */

import { RecipeLibrary } from './library';
import { normalizeIngredientName } from './shoppingListAggregator';
import { COLES_INGREDIENT_MAPPINGS } from './colesMapping';

const INGREDIENT_FREQUENCY_KEY = 'meal-agent:ingredient-frequency:v1';
const ANALYTICS_TIMESTAMP_KEY = 'meal-agent:analytics-timestamp:v1';

export interface IngredientFrequency {
  normalizedName: string;
  displayName: string; // Most common variant
  count: number;
  recipes: string[]; // Recipe IDs that use this ingredient
  isMapped: boolean;
  firstSeen: string; // ISO date
  lastSeen: string; // ISO date
}

export interface IngredientAnalytics {
  totalTrackedRecipes: number;
  totalIngredients: number;
  mappedIngredients: number;
  unmappedIngredients: number;
  mostUsedIngredients: IngredientFrequency[];
  unmappedPriorityList: IngredientFrequency[];
  lastUpdated: string;
}

/**
 * Check if an ingredient has a Coles mapping
 */
function hasColesMapping(normalizedName: string): boolean {
  return COLES_INGREDIENT_MAPPINGS.some(
    mapping => mapping.normalizedName === normalizedName
  );
}

/**
 * Load ingredient frequency data from localStorage
 */
function loadFrequencyData(): Map<string, IngredientFrequency> {
  try {
    const data = localStorage.getItem(INGREDIENT_FREQUENCY_KEY);
    if (!data) return new Map();
    
    const parsed = JSON.parse(data);
    return new Map(Object.entries(parsed));
  } catch (error) {
    console.error('Failed to load ingredient frequency data:', error);
    return new Map();
  }
}

/**
 * Save ingredient frequency data to localStorage
 */
function saveFrequencyData(data: Map<string, IngredientFrequency>): void {
  try {
    const obj = Object.fromEntries(data);
    localStorage.setItem(INGREDIENT_FREQUENCY_KEY, JSON.stringify(obj));
    localStorage.setItem(ANALYTICS_TIMESTAMP_KEY, new Date().toISOString());
  } catch (error) {
    console.error('Failed to save ingredient frequency data:', error);
  }
}

/**
 * Track ingredients from a list of recipe IDs
 * Call this when a meal plan is generated or saved
 */
export function trackIngredientUsage(recipeIds: string[]): void {
  // Load existing frequency data
  const frequencyMap = loadFrequencyData();
  const now = new Date().toISOString();
  
  // Get recipes from library - filter out empty strings and nulls
  const recipes = recipeIds
    .filter(id => id && id.trim() !== '') // Remove empty/whitespace-only IDs
    .map(id => RecipeLibrary.getById(id))
    .filter((r): r is NonNullable<typeof r> => r !== null && r !== undefined);
  
  console.log(`📊 Tracking ingredients from ${recipes.length} recipes (${recipeIds.length} IDs provided)...`);
  
  // Process each recipe's ingredients
  recipes.forEach(recipe => {
    if (!recipe || !recipe.ingredients || !Array.isArray(recipe.ingredients)) {
      return;
    }
    
    recipe.ingredients.forEach(ingredient => {
      if (!ingredient || !ingredient.name) return;
      
      const normalized = normalizeIngredientName(ingredient.name);
      if (!normalized) return;
      
      const existing = frequencyMap.get(normalized);
      
      if (existing) {
        // Update existing entry
        existing.count++;
        existing.lastSeen = now;
        if (!existing.recipes.includes(recipe.id)) {
          existing.recipes.push(recipe.id);
        }
      } else {
        // Create new entry
        frequencyMap.set(normalized, {
          normalizedName: normalized,
          displayName: ingredient.name, // Keep original name as display
          count: 1,
          recipes: [recipe.id],
          isMapped: hasColesMapping(normalized),
          firstSeen: now,
          lastSeen: now,
        });
      }
    });
  });
  
  // Update mapping status for all ingredients (in case colesMapping.ts was updated)
  frequencyMap.forEach(freq => {
    freq.isMapped = hasColesMapping(freq.normalizedName);
  });
  
  // Save updated data
  saveFrequencyData(frequencyMap);
  
  console.log(`✅ Tracked ${frequencyMap.size} unique ingredients`);
}

/**
 * Get comprehensive analytics about ingredient usage
 */
export function getIngredientAnalytics(): IngredientAnalytics {
  const frequencyMap = loadFrequencyData();
  const allIngredients = Array.from(frequencyMap.values());
  
  // Sort by usage count
  allIngredients.sort((a, b) => b.count - a.count);
  
  // Get unmapped ingredients sorted by priority (usage frequency)
  const unmappedIngredients = allIngredients
    .filter(ing => !ing.isMapped)
    .sort((a, b) => b.count - a.count);
  
  const lastUpdated = localStorage.getItem(ANALYTICS_TIMESTAMP_KEY) || new Date().toISOString();
  
  return {
    totalTrackedRecipes: new Set(allIngredients.flatMap(i => i.recipes)).size,
    totalIngredients: allIngredients.length,
    mappedIngredients: allIngredients.filter(i => i.isMapped).length,
    unmappedIngredients: unmappedIngredients.length,
    mostUsedIngredients: allIngredients.slice(0, 50),
    unmappedPriorityList: unmappedIngredients.slice(0, 100),
    lastUpdated,
  };
}

/**
 * Generate a text report of top unmapped ingredients
 * Useful for determining which ingredients to add to colesMapping.ts
 */
export function generatePriorityReport(): string {
  const analytics = getIngredientAnalytics();
  
  let report = '=== INGREDIENT PRICING PRIORITY REPORT ===\n\n';
  report += `Total tracked recipes: ${analytics.totalTrackedRecipes}\n`;
  report += `Total unique ingredients: ${analytics.totalIngredients}\n`;
  report += `Mapped with Coles prices: ${analytics.mappedIngredients} (${Math.round(analytics.mappedIngredients / analytics.totalIngredients * 100)}%)\n`;
  report += `Unmapped (need pricing): ${analytics.unmappedIngredients} (${Math.round(analytics.unmappedIngredients / analytics.totalIngredients * 100)}%)\n`;
  report += `\nLast updated: ${new Date(analytics.lastUpdated).toLocaleString()}\n`;
  
  report += '\n\n=== TOP 50 UNMAPPED INGREDIENTS (Priority for colesMapping.ts) ===\n\n';
  report += 'Rank | Count | Ingredient Name | Normalized Name\n';
  report += '-----+-------+-----------------------------------------+-------------------------\n';
  
  analytics.unmappedPriorityList.slice(0, 50).forEach((ing, index) => {
    const rank = String(index + 1).padStart(4);
    const count = String(ing.count).padStart(5);
    const display = ing.displayName.padEnd(40).slice(0, 40);
    const normalized = ing.normalizedName;
    report += `${rank} | ${count} | ${display} | ${normalized}\n`;
  });
  
  report += '\n\n=== TOP 20 MOST USED INGREDIENTS (All) ===\n\n';
  report += 'Rank | Count | Mapped | Ingredient Name\n';
  report += '-----+-------+--------+----------------------------------------\n';
  
  analytics.mostUsedIngredients.slice(0, 20).forEach((ing, index) => {
    const rank = String(index + 1).padStart(4);
    const count = String(ing.count).padStart(5);
    const mapped = ing.isMapped ? '   ✓   ' : '   ✗   ';
    const display = ing.displayName;
    report += `${rank} | ${count} | ${mapped} | ${display}\n`;
  });
  
  return report;
}

/**
 * Reset all ingredient frequency data
 * Useful for testing or starting fresh
 */
export function resetIngredientAnalytics(): void {
  localStorage.removeItem(INGREDIENT_FREQUENCY_KEY);
  localStorage.removeItem(ANALYTICS_TIMESTAMP_KEY);
  console.log('🗑️  Ingredient analytics data cleared');
}

/**
 * Export frequency data as JSON for analysis
 */
export function exportIngredientData(): string {
  const analytics = getIngredientAnalytics();
  return JSON.stringify(analytics, null, 2);
}
