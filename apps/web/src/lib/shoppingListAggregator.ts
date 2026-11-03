import { type PlanWeek } from "./types/recipe";
import { RecipeLibrary } from "./library";
import { track, type IngredientReusedMeta } from "./analytics";
import { loadPantryPreferences } from "./pantryPreferences";
import type { CatalogueEntry, Measure } from "./ingredients/catalogue";
import { ingredientKey, resolveIngredient } from "./ingredients/resolve";
import { buyQuantity, displayQuantity, formatBaseQuantity, pricingQuantity, toBaseQuantity } from "./ingredients/quantity";

export interface AggregatedIngredient {
  name: string;
  /** Canonical ingredient key (#183): used for pantry preferences and pricing. */
  normalizedName: string;
  /** Recipe total in display units (kg/g, L/ml, or a count). */
  totalQty: number;
  unit: string;
  /** Recipe total as text, including any unconvertible extras: "6 cloves", "1.2 kg + 1 pinch". */
  quantityLabel: string;
  /** Recipe quantities that couldn't be converted into this ingredient's measure. */
  extraQuantities: Array<{ qty: number; unit: string }>;
  /** Packs to buy, when the ingredient is sold in packs or as whole items. */
  buyQty?: number;
  /** What one pack is: "bulb", "× 400 g cans"; '' for whole items. */
  buyUnit?: string;
  /** What to buy as text: "1 bulb", "2 × 400 g cans", "3". */
  buyLabel?: string;
  /** Quantity to pass to estimateIngredientCost, in units Coles pack sizes understand. */
  priceQty: number;
  priceUnit: string;
  category: string;
  sourceRecipes: Array<{ recipeId: string; recipeTitle: string; qty: number; unit: string }>;
  isPantryStaple?: boolean;
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
function isInUserPantry(key: string, pantryKeys: string[]): boolean {
  return pantryKeys.some(pantryKey => key === pantryKey || key.includes(pantryKey));
}

interface LineBuilder {
  key: string;
  name: string;
  entry?: CatalogueEntry;
  measure?: Measure;
  amount: number;
  extras: Map<string, number>;
  sourceRecipes: AggregatedIngredient['sourceRecipes'];
  isPantryStaple: boolean;
}

function formatExtras(extras: Map<string, number>): string {
  return Array.from(extras, ([unit, qty]) => `${Math.round(qty * 10) / 10}${unit ? ` ${unit}` : ''}`).join(' + ');
}

function finishLine(line: LineBuilder): AggregatedIngredient {
  const extraQuantities = Array.from(line.extras, ([unit, qty]) => ({ qty: Math.round(qty * 10) / 10, unit }));
  const base = {
    name: line.name,
    normalizedName: line.key,
    category: line.entry?.category ?? categorizeIngredient(line.name),
    sourceRecipes: line.sourceRecipes,
    isPantryStaple: line.isPantryStaple,
    extraQuantities,
  };

  if (!line.measure) {
    // Nothing converted: show the recipes' own quantities as they were written.
    const [first] = extraQuantities;
    return {
      ...base,
      totalQty: first?.qty ?? 0,
      unit: first?.unit ?? '',
      quantityLabel: formatExtras(line.extras),
      extraQuantities: extraQuantities.slice(1),
      priceQty: first?.qty ?? 0,
      priceUnit: first?.unit ?? '',
    };
  }

  const display = displayQuantity(line.measure, line.amount, line.entry?.countNoun);
  const total = formatBaseQuantity(line.measure, line.amount, line.entry?.countNoun);
  const buy = buyQuantity(line.entry, line.measure, line.amount);
  const price = pricingQuantity(line.entry, line.measure, line.amount);
  return {
    ...base,
    totalQty: Math.round(display.qty * 10) / 10,
    unit: display.unit,
    quantityLabel: line.extras.size > 0 ? `${total} + ${formatExtras(line.extras)}` : total,
    buyQty: buy?.qty,
    buyUnit: buy?.unit,
    buyLabel: buy?.label,
    priceQty: price.qty,
    priceUnit: price.unit,
  };
}

/**
 * Aggregate ingredients from a meal plan into a shopping list: one line per
 * canonical ingredient (#183), with every quantity converted into that
 * ingredient's measure and rounded up to what you'd buy.
 */
export function aggregateShoppingList(
  plan: PlanWeek,
  options: {
    userPantryItems?: Array<{ name: string; qty: number; unit: string }>;
  } = {}
): AggregatedIngredient[] {
  const lines = new Map<string, LineBuilder>();
  // Preferences saved before #183 may hold old-style names ("onions"), so compare by resolved key.
  const pantryPreferenceKeys = new Set(Array.from(loadPantryPreferences(), name => ingredientKey(name) || name));
  const userPantryKeys = (options.userPantryItems ?? []).map(item => ingredientKey(item.name)).filter(Boolean);

  for (const day of plan.days) {
    const recipe = RecipeLibrary.getById(day.recipeId);
    if (!recipe) continue;

    // Skip leftover days (they don't add new ingredients)
    if (day.notes?.includes('Leftovers')) continue;

    const scaleFactor = day.scaledServings / (recipe.serves || 4);

    for (const ingredient of recipe.ingredients) {
      if (!ingredient || !ingredient.name) continue;
      const resolved = resolveIngredient(ingredient.name);
      if (!resolved) continue;

      let line = lines.get(resolved.key);
      if (!line) {
        line = {
          key: resolved.key,
          name: resolved.displayName,
          entry: resolved.entry,
          amount: 0,
          extras: new Map(),
          sourceRecipes: [],
          isPantryStaple: false,
        };
        lines.set(resolved.key, line);
      }

      const qty = ingredient.qty * scaleFactor;
      const base = toBaseQuantity(line.entry, qty, ingredient.unit);
      if (base && (!line.measure || line.measure === base.measure)) {
        line.measure = base.measure;
        line.amount += base.amount;
      } else {
        // Can't be converted into this line's measure: keep it on the same line as a note.
        const unit = (ingredient.unit || '').trim().toLowerCase();
        line.extras.set(unit, (line.extras.get(unit) ?? 0) + qty);
      }

      line.sourceRecipes.push({ recipeId: recipe.id, recipeTitle: recipe.title, qty, unit: ingredient.unit || '' });
      if (isInUserPantry(resolved.key, userPantryKeys) || pantryPreferenceKeys.has(resolved.key)) {
        line.isPantryStaple = true;
      }
    }
  }

  const aggregated = Array.from(lines.values(), finishLine);

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
    quantity: item.buyQty ?? item.totalQty,
    unit: item.buyQty !== undefined ? item.buyUnit ?? '' : item.unit,
    category: item.category
  }));
}
