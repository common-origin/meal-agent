import { type PlanWeek } from "./types/recipe";
import { RecipeLibrary } from "./library";
import { track, type IngredientReusedMeta } from "./analytics";
import { normalizeToBaseUnit, formatForDisplay } from "./unitConversion";
import { isInPantryPreferences } from "./pantryPreferences";

export interface AggregatedIngredient {
  name: string;
  normalizedName: string; // For deduplication
  totalQty: number;
  unit: string;
  category: string;
  sourceRecipes: Array<{ recipeId: string; recipeTitle: string; qty: number }>;
  isPantryStaple?: boolean;
}



/**
 * Normalize ingredient name for deduplication
 * Removes common variations and standardizes format
 */
export function normalizeIngredientName(name: string): string {
  // Handle missing or invalid name
  if (!name || typeof name !== 'string') {
    return '';
  }
  
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+or\s+.*$/g, '') // Remove "or" alternatives (e.g., "ghee or oil" -> "ghee")
    .replace(/\s+and\/or\s+.*$/g, '') // Remove "and/or" alternatives
    .replace(/^(fresh|dried|ground|chopped|sliced|diced|minced|grated|crushed|shredded|raw|cooked)\s+/g, '') // Remove prep descriptors
    .replace(/^(plain|greek|whole|full cream|low fat|reduced fat|extra virgin|unsalted|salted|canned|frozen)\s+/g, '') // Remove quality descriptors
    .replace(/\s+(plain|greek|whole|full cream|low fat|reduced fat|extra virgin|unsalted|salted|canned|frozen)$/g, '') // Remove trailing descriptors
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
 * Check if ingredient is in user's pantry inventory
 */
function isInUserPantry(name: string, userPantryItems?: Array<{ name: string; qty: number; unit: string }>): boolean {
  if (!userPantryItems || userPantryItems.length === 0) return false;
  
  const normalized = normalizeIngredientName(name);
  return userPantryItems.some(pantryItem => {
    const pantryNormalized = normalizeIngredientName(pantryItem.name);
    return pantryNormalized === normalized || normalized.includes(pantryNormalized);
  });
}

/**
 * Aggregate ingredients from a meal plan into a shopping list
 * with deduplication, unit conversion, and source tracking
 */
export function aggregateShoppingList(
  plan: PlanWeek,
  options: {
    userPantryItems?: Array<{ name: string; qty: number; unit: string }>;
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
      // Skip ingredients with missing data
      if (!ingredient || !ingredient.name) continue;
      
      const normalizedName = normalizeIngredientName(ingredient.name);
      
      // Skip empty normalized names
      if (!normalizedName) continue;
      
      // Check if ingredient is in user's pantry or marked as pantry preference
      const inUserPantry = isInUserPantry(ingredient.name, options.userPantryItems);
      const isUserPantryPref = isInPantryPreferences(normalizedName);
      const isPantryItem = inUserPantry || isUserPantryPref;
      
      // Convert to base unit for aggregation (handle missing unit)
      const converted = normalizeToBaseUnit(
        ingredient.qty * scaleFactor, 
        ingredient.unit || ''
      );
      const convertedQty = converted.quantity;
      const convertedUnit = converted.unit;
      
      // Check if already exists
      const existing = ingredientMap.get(normalizedName);
      
      if (existing && existing.unit === convertedUnit) {
        // Same ingredient, same unit - aggregate
        existing.totalQty += convertedQty;
        existing.sourceRecipes.push({
          recipeId: recipe.id,
          recipeTitle: recipe.title,
          qty: ingredient.qty * scaleFactor
        });
      } else if (existing && existing.unit !== convertedUnit) {
        // Same ingredient, different unit - can't easily aggregate
        // Create a separate entry with modified name
        const key = `${normalizedName}_${convertedUnit}`;
        ingredientMap.set(key, {
          name: ingredient.name,
          normalizedName,
          totalQty: convertedQty,
          unit: convertedUnit,
          category: categorizeIngredient(ingredient.name),
          sourceRecipes: [{
            recipeId: recipe.id,
            recipeTitle: recipe.title,
            qty: ingredient.qty * scaleFactor
          }],
          isPantryStaple: isPantryItem
        });
      } else {
        // New ingredient
        ingredientMap.set(normalizedName, {
          name: ingredient.name,
          normalizedName,
          totalQty: convertedQty,
          unit: convertedUnit,
          category: categorizeIngredient(ingredient.name),
          sourceRecipes: [{
            recipeId: recipe.id,
            recipeTitle: recipe.title,
            qty: ingredient.qty * scaleFactor
          }],
          isPantryStaple: isPantryItem
        });
      }
    }
  }
  
  // Convert to array and format quantities for display
  const aggregated = Array.from(ingredientMap.values()).map(item => {
    const formatted = formatForDisplay(item.totalQty, item.unit);
    return {
      ...item,
      totalQty: Math.round(formatted.quantity * 10) / 10, // Round to 1 decimal
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
