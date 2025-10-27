import { type PlanWeek } from "./types/recipe";
import { RecipeLibrary } from "./library";
import { track, type IngredientReusedMeta } from "./analytics";

export interface AggregatedIngredient {
  name: string;
  normalizedName: string; // For deduplication
  totalQty: number;
  unit: string;
  category: string;
  sourceRecipes: Array<{ recipeId: string; recipeTitle: string; qty: number }>;
  isPantryStaple?: boolean;
}

// Unit conversion constants
const UNIT_CONVERSIONS: Record<string, { toBase: number; baseUnit: string }> = {
  // Weight
  'g': { toBase: 1, baseUnit: 'g' },
  'kg': { toBase: 1000, baseUnit: 'g' },
  
  // Volume
  'ml': { toBase: 1, baseUnit: 'ml' },
  'l': { toBase: 1000, baseUnit: 'ml' },
  'tsp': { toBase: 5, baseUnit: 'ml' },
  'tbsp': { toBase: 15, baseUnit: 'ml' },
  'cup': { toBase: 250, baseUnit: 'ml' },
  
  // Count
  'unit': { toBase: 1, baseUnit: 'unit' },
  'units': { toBase: 1, baseUnit: 'unit' },
  'piece': { toBase: 1, baseUnit: 'unit' },
  'pieces': { toBase: 1, baseUnit: 'unit' },
};

// Common pantry staples that can be optionally filtered
const PANTRY_STAPLES = new Set([
  'salt', 'pepper', 'olive oil', 'vegetable oil', 'flour', 'sugar',
  'baking powder', 'baking soda', 'vinegar', 'soy sauce', 'water'
]);

/**
 * Normalize ingredient name for deduplication
 * Removes common variations and standardizes format
 */
function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/^(fresh|dried|ground|chopped|sliced|diced)\s+/g, '') // Remove prep descriptors
    .replace(/\s+\(.*?\)/g, '') // Remove parenthetical notes
    .replace(/,.*$/g, '') // Remove anything after comma
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Categorize ingredient based on name
 * This is a simple heuristic - can be enhanced with lookup table
 */
function categorizeIngredient(name: string): string {
  const normalized = name.toLowerCase();
  
  // Proteins
  if (/chicken|beef|pork|lamb|fish|salmon|tuna|prawns|shrimp/.test(normalized)) {
    return 'Meat & Seafood';
  }
  
  // Dairy
  if (/milk|cream|cheese|yogurt|butter/.test(normalized)) {
    return 'Dairy & Eggs';
  }
  
  // Produce
  if (/tomato|onion|garlic|carrot|potato|lettuce|cucumber|capsicum|pepper|zucchini|mushroom|spinach|broccoli|cauliflower/.test(normalized)) {
    return 'Fresh Produce';
  }
  
  // Pantry
  if (/pasta|rice|noodle|flour|sugar|salt|pepper|oil|vinegar|sauce|stock|spice/.test(normalized)) {
    return 'Pantry';
  }
  
  // Canned/Packaged
  if (/canned|tinned|jar|packet/.test(normalized)) {
    return 'Canned & Packaged';
  }
  
  // Bakery
  if (/bread|bun|roll|wrap|tortilla/.test(normalized)) {
    return 'Bakery';
  }
  
  // Frozen
  if (/frozen/.test(normalized)) {
    return 'Frozen';
  }
  
  return 'Other';
}

/**
 * Convert ingredient quantity to base unit
 */
function convertToBaseUnit(qty: number, unit: string): { qty: number; unit: string } {
  const normalized = unit.toLowerCase().trim();
  const conversion = UNIT_CONVERSIONS[normalized];
  
  if (!conversion) {
    // Unknown unit, return as-is
    return { qty, unit };
  }
  
  return {
    qty: qty * conversion.toBase,
    unit: conversion.baseUnit
  };
}

/**
 * Format quantity for display (e.g., convert 1000g to 1kg)
 */
function formatQuantity(qty: number, unit: string): { qty: number; unit: string } {
  // Convert large gram quantities to kg
  if (unit === 'g' && qty >= 1000) {
    return { qty: qty / 1000, unit: 'kg' };
  }
  
  // Convert large ml quantities to L
  if (unit === 'ml' && qty >= 1000) {
    return { qty: qty / 1000, unit: 'L' };
  }
  
  return { qty, unit };
}

/**
 * Check if ingredient is a pantry staple
 */
function isPantryStaple(name: string): boolean {
  const normalized = normalizeIngredientName(name);
  return PANTRY_STAPLES.has(normalized) || 
         Array.from(PANTRY_STAPLES).some(staple => normalized.includes(staple));
}

/**
 * Aggregate ingredients from a meal plan into a shopping list
 * with deduplication, unit conversion, and source tracking
 */
export function aggregateShoppingList(
  plan: PlanWeek,
  options: {
    excludePantryStaples?: boolean;
    pantryItems?: Array<{ name: string; qty: number; unit: string }>;
  } = {}
): AggregatedIngredient[] {
  const ingredientMap = new Map<string, AggregatedIngredient>();
  
  // Process each day's recipe
  for (const day of plan.days) {
    const recipe = RecipeLibrary.getById(day.recipeId);
    if (!recipe) continue;
    
    // Skip leftover days (they don't add new ingredients)
    if (day.notes?.includes('Leftovers')) continue;
    
    const scaleFactor = day.scaledServings / (recipe.serves || 4);
    
    for (const ingredient of recipe.ingredients) {
      const normalizedName = normalizeIngredientName(ingredient.name);
      
      // Check pantry exclusion
      const isStaple = isPantryStaple(ingredient.name);
      if (options.excludePantryStaples && isStaple) continue;
      
      // Convert to base unit for aggregation
      const converted = convertToBaseUnit(ingredient.qty * scaleFactor, ingredient.unit);
      
      // Check if already exists
      const existing = ingredientMap.get(normalizedName);
      
      if (existing && existing.unit === converted.unit) {
        // Same ingredient, same unit - aggregate
        existing.totalQty += converted.qty;
        existing.sourceRecipes.push({
          recipeId: recipe.id,
          recipeTitle: recipe.title,
          qty: ingredient.qty * scaleFactor
        });
      } else if (existing && existing.unit !== converted.unit) {
        // Same ingredient, different unit - can't easily aggregate
        // Create a separate entry with modified name
        const key = `${normalizedName}_${converted.unit}`;
        ingredientMap.set(key, {
          name: ingredient.name,
          normalizedName,
          totalQty: converted.qty,
          unit: converted.unit,
          category: categorizeIngredient(ingredient.name),
          sourceRecipes: [{
            recipeId: recipe.id,
            recipeTitle: recipe.title,
            qty: ingredient.qty * scaleFactor
          }],
          isPantryStaple: isStaple
        });
      } else {
        // New ingredient
        ingredientMap.set(normalizedName, {
          name: ingredient.name,
          normalizedName,
          totalQty: converted.qty,
          unit: converted.unit,
          category: categorizeIngredient(ingredient.name),
          sourceRecipes: [{
            recipeId: recipe.id,
            recipeTitle: recipe.title,
            qty: ingredient.qty * scaleFactor
          }],
          isPantryStaple: isStaple
        });
      }
    }
  }
  
  // Subtract pantry items if provided
  if (options.pantryItems) {
    for (const pantryItem of options.pantryItems) {
      const normalized = normalizeIngredientName(pantryItem.name);
      const existing = ingredientMap.get(normalized);
      
      if (existing) {
        const converted = convertToBaseUnit(pantryItem.qty, pantryItem.unit);
        if (existing.unit === converted.unit) {
          existing.totalQty = Math.max(0, existing.totalQty - converted.qty);
          
          // Remove if quantity is now zero or negative
          if (existing.totalQty <= 0) {
            ingredientMap.delete(normalized);
          }
        }
      }
    }
  }
  
  // Convert to array and format quantities
  const aggregated = Array.from(ingredientMap.values()).map(item => {
    const formatted = formatQuantity(item.totalQty, item.unit);
    return {
      ...item,
      totalQty: Math.round(formatted.qty * 10) / 10, // Round to 1 decimal
      unit: formatted.unit
    };
  });
  
  // Track ingredient reuse analytics
  aggregated.forEach(item => {
    if (item.sourceRecipes.length >= 2) {
      const packsSaved = item.sourceRecipes.length - 1; // Each reuse saves ~1 pack
      const reuseMeta: IngredientReusedMeta = {
        ingredient: item.normalizedName,
        recipeCount: item.sourceRecipes.length,
        totalQuantity: item.totalQty,
        packsSaved
      };
      track('ingredient_reused', reuseMeta);
    }
  });
  
  // Sort by category, then name
  return aggregated.sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Convert aggregated shopping list to legacy Ingredient format for CSV export
 */
export function toLegacyFormat(aggregated: AggregatedIngredient[]): Array<{
  name: string;
  quantity: number;
  unit: string;
  category: string;
}> {
  return aggregated.map(item => ({
    name: item.name,
    quantity: item.totalQty,
    unit: item.unit,
    category: item.category
  }));
}
