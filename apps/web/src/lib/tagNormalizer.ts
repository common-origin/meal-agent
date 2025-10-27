/**
 * Tag Normalizer
 * Infers structured tags from recipe metadata and ingredients
 */

import type { Recipe } from "./types/recipe";

/**
 * Normalized tag types for meal planning
 */
export const TAG_TYPES = {
  // Dietary
  KID_FRIENDLY: "kid_friendly",
  GLUTEN_LIGHT: "gluten_light",
  HIGH_PROTEIN: "high_protein",
  VEGETARIAN: "vegetarian",
  VEGAN: "vegan",
  DAIRY_FREE: "dairy_free",
  
  // Cooking style
  QUICK: "quick", // ≤30 mins
  SIMPLE: "simple", // ≤10 ingredients
  BULK_COOK: "bulk_cook", // Serves ≥6 or tagged for meal prep
  ONE_POT: "one_pot",
  
  // Occasion
  WEEKNIGHT: "weeknight",
  WEEKEND: "weekend",
  PARTY_FOOD: "party_food",
  BBQ: "bbq",
  
  // Protein
  CHICKEN: "chicken",
  BEEF: "beef",
  PORK: "pork",
  FISH: "fish",
  LAMB: "lamb",
  SEAFOOD: "seafood",
  
  // Other
  ORGANIC_OK: "organic_ok", // Uses common organic ingredients
} as const;

/**
 * Keywords that indicate kid-friendly recipes
 */
const KID_FRIENDLY_KEYWORDS = [
  "kid",
  "child",
  "family",
  "nugget",
  "tender",
  "finger food",
  "mild",
  "simple",
];

/**
 * Keywords that indicate gluten-light recipes (naturally low gluten or easy to modify)
 */
const GLUTEN_LIGHT_KEYWORDS = [
  "rice",
  "potato",
  "gluten free",
  "salad",
  "grilled",
  "roasted",
];

/**
 * High-protein ingredients
 */
const HIGH_PROTEIN_INGREDIENTS = [
  "chicken",
  "beef",
  "pork",
  "lamb",
  "fish",
  "salmon",
  "tuna",
  "prawn",
  "shrimp",
  "egg",
  "tofu",
  "lentil",
  "bean",
  "chickpea",
];

/**
 * Ingredients that exclude vegetarian classification
 */
const MEAT_INGREDIENTS = [
  "chicken",
  "beef",
  "pork",
  "lamb",
  "bacon",
  "sausage",
  "mince",
  "fish",
  "salmon",
  "tuna",
  "prawn",
  "shrimp",
  "seafood",
  "meat",
];

/**
 * Ingredients commonly available organic
 */
const ORGANIC_FRIENDLY_INGREDIENTS = [
  "spinach",
  "kale",
  "lettuce",
  "tomato",
  "carrot",
  "broccoli",
  "cauliflower",
  "zucchini",
  "bell pepper",
  "capsicum",
  "mushroom",
  "onion",
  "garlic",
  "herbs",
  "chicken",
  "egg",
];

/**
 * Infer tags from recipe data
 */
export function inferTags(recipe: Recipe): string[] {
  const inferred = new Set<string>(recipe.tags || []);
  
  // Time-based tags
  if (recipe.timeMins !== undefined) {
    if (recipe.timeMins <= 30) {
      inferred.add(TAG_TYPES.QUICK);
      inferred.add(TAG_TYPES.WEEKNIGHT);
    }
    if (recipe.timeMins <= 40) {
      inferred.add(TAG_TYPES.WEEKNIGHT);
    }
  }
  
  // Ingredient count
  if (recipe.ingredients.length <= 10) {
    inferred.add(TAG_TYPES.SIMPLE);
  }
  
  // Bulk cook (serves 6+)
  if (recipe.serves && recipe.serves >= 6) {
    inferred.add(TAG_TYPES.BULK_COOK);
  }
  
  // Check title and existing tags
  const titleLower = recipe.title.toLowerCase();
  const tagsLower = recipe.tags.map(t => t.toLowerCase()).join(" ");
  const searchText = `${titleLower} ${tagsLower}`;
  
  // Kid friendly
  if (KID_FRIENDLY_KEYWORDS.some(kw => searchText.includes(kw))) {
    inferred.add(TAG_TYPES.KID_FRIENDLY);
  }
  
  // Gluten light
  if (GLUTEN_LIGHT_KEYWORDS.some(kw => searchText.includes(kw))) {
    inferred.add(TAG_TYPES.GLUTEN_LIGHT);
  }
  
  // Check ingredients
  const ingredientNames = recipe.ingredients
    .map(ing => ing.name.toLowerCase())
    .join(" ");
  
  // High protein
  if (HIGH_PROTEIN_INGREDIENTS.some(ing => ingredientNames.includes(ing))) {
    inferred.add(TAG_TYPES.HIGH_PROTEIN);
  }
  
  // Vegetarian check (no meat ingredients)
  const hasMeat = MEAT_INGREDIENTS.some(meat => ingredientNames.includes(meat));
  if (!hasMeat) {
    inferred.add(TAG_TYPES.VEGETARIAN);
  }
  
  // Protein types
  if (ingredientNames.includes("chicken")) inferred.add(TAG_TYPES.CHICKEN);
  if (ingredientNames.includes("beef")) inferred.add(TAG_TYPES.BEEF);
  if (ingredientNames.includes("pork") || ingredientNames.includes("bacon")) {
    inferred.add(TAG_TYPES.PORK);
  }
  if (ingredientNames.includes("fish") || ingredientNames.includes("salmon") || 
      ingredientNames.includes("tuna")) {
    inferred.add(TAG_TYPES.FISH);
  }
  if (ingredientNames.includes("lamb")) inferred.add(TAG_TYPES.LAMB);
  if (ingredientNames.includes("prawn") || ingredientNames.includes("shrimp")) {
    inferred.add(TAG_TYPES.SEAFOOD);
  }
  
  // Organic friendly (uses >50% organic-friendly ingredients)
  const organicCount = ORGANIC_FRIENDLY_INGREDIENTS.filter(ing => 
    ingredientNames.includes(ing)
  ).length;
  if (organicCount / recipe.ingredients.length > 0.5) {
    inferred.add(TAG_TYPES.ORGANIC_OK);
  }
  
  return Array.from(inferred);
}

/**
 * Normalize existing tags to standard format
 */
export function normalizeTags(tags: string[]): string[] {
  const normalized = new Set<string>();
  
  for (const tag of tags) {
    const lower = tag.toLowerCase().replace(/[_\s-]+/g, "_");
    
    // Map common variations to standard tags
    if (lower.includes("kid") || lower.includes("family")) {
      normalized.add(TAG_TYPES.KID_FRIENDLY);
    }
    if (lower.includes("quick") || lower.includes("fast") || lower.includes("express")) {
      normalized.add(TAG_TYPES.QUICK);
    }
    if (lower.includes("simple") || lower.includes("easy")) {
      normalized.add(TAG_TYPES.SIMPLE);
    }
    if (lower.includes("bulk") || lower.includes("batch") || lower.includes("meal_prep")) {
      normalized.add(TAG_TYPES.BULK_COOK);
    }
    if (lower.includes("vegetarian") || lower.includes("veggie")) {
      normalized.add(TAG_TYPES.VEGETARIAN);
    }
    if (lower.includes("vegan")) {
      normalized.add(TAG_TYPES.VEGAN);
    }
    if (lower.includes("party") || lower.includes("appetizer") || lower.includes("finger")) {
      normalized.add(TAG_TYPES.PARTY_FOOD);
    }
    if (lower.includes("bbq") || lower.includes("grill")) {
      normalized.add(TAG_TYPES.BBQ);
    }
    if (lower.includes("chicken")) {
      normalized.add(TAG_TYPES.CHICKEN);
    }
    if (lower.includes("beef")) {
      normalized.add(TAG_TYPES.BEEF);
    }
    if (lower.includes("pork")) {
      normalized.add(TAG_TYPES.PORK);
    }
    
    // Keep original tag as well
    normalized.add(lower);
  }
  
  return Array.from(normalized);
}

/**
 * Enhance recipe with inferred and normalized tags
 */
export function enhanceRecipeWithTags(recipe: Recipe): Recipe {
  const normalizedExisting = normalizeTags(recipe.tags);
  const inferred = inferTags(recipe);
  
  // Combine and deduplicate
  const allTags = new Set([...normalizedExisting, ...inferred]);
  
  return {
    ...recipe,
    tags: Array.from(allTags).sort()
  };
}
