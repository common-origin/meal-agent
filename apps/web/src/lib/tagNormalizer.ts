/**
 * Tag Normalizer (Refactored)
 * Clean, accurate tag inference and normalization for recipes
 */

import type { Recipe } from "./types/recipe";

/**
 * Valid recipe tags - single source of truth
 */
export const VALID_TAGS = [
  // Dietary
  'kid_friendly',
  'gluten_light',
  'high_protein',
  'vegetarian',
  'vegan',
  'dairy_free',
  
  // Cooking style
  'quick',
  'simple',
  'bulk_cook',
  'one_pot',
  
  // Occasion
  'weeknight',
  'weekend',
  'party_food',
  'bbq',
  
  // Protein
  'chicken',
  'beef',
  'pork',
  'fish',
  'lamb',
  'seafood',
  
  // Other
  'organic_ok',
] as const;

export type RecipeTag = typeof VALID_TAGS[number];

const VALID_TAG_SET = new Set(VALID_TAGS);

/**
 * Format a tag for display to users (converts underscores to spaces, capitalizes)
 */
export function formatTagForDisplay(tag: string): string {
  return tag
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format multiple tags for display
 */
export function formatTagsForDisplay(tags: string[]): string[] {
  return tags.map(formatTagForDisplay);
}

/**
 * Deprecated - kept for backwards compatibility
 */
export const TAG_TYPES = {
  KID_FRIENDLY: "kid_friendly",
  GLUTEN_LIGHT: "gluten_light",
  HIGH_PROTEIN: "high_protein",
  VEGETARIAN: "vegetarian",
  VEGAN: "vegan",
  DAIRY_FREE: "dairy_free",
  QUICK: "quick",
  SIMPLE: "simple",
  BULK_COOK: "bulk_cook",
  ONE_POT: "one_pot",
  WEEKNIGHT: "weeknight",
  WEEKEND: "weekend",
  PARTY_FOOD: "party_food",
  BBQ: "bbq",
  CHICKEN: "chicken",
  BEEF: "beef",
  PORK: "pork",
  FISH: "fish",
  LAMB: "lamb",
  SEAFOOD: "seafood",
  ORGANIC_OK: "organic_ok",
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
 * Infer tags from recipe data (pure inference, no copying existing tags)
 */
function inferTagsFromRecipe(recipe: Recipe): Set<string> {
  const tags = new Set<string>();
  
  // Time-based tags
  if (recipe.timeMins !== undefined) {
    if (recipe.timeMins <= 30) {
      tags.add('quick');
      tags.add('weeknight');
    } else if (recipe.timeMins <= 40) {
      tags.add('weeknight');
    }
  }
  
  // Ingredient count
  if (recipe.ingredients.length <= 10) {
    tags.add('simple');
  }
  
  // Bulk cook (serves 6+)
  if (recipe.serves && recipe.serves >= 6) {
    tags.add('bulk_cook');
  }
  
  // Check title and existing tags for hints
  const titleLower = recipe.title.toLowerCase();
  const tagsLower = recipe.tags.map(t => t.toLowerCase()).join(" ");
  const searchText = `${titleLower} ${tagsLower}`;
  
  // Kid friendly
  if (KID_FRIENDLY_KEYWORDS.some(kw => searchText.includes(kw))) {
    tags.add('kid_friendly');
  }
  
  // Gluten light
  if (GLUTEN_LIGHT_KEYWORDS.some(kw => searchText.includes(kw))) {
    tags.add('gluten_light');
  }
  
  // Check ingredients
  const ingredientNames = recipe.ingredients
    .map(ing => ing.name.toLowerCase())
    .join(" ");
  
  // High protein
  if (HIGH_PROTEIN_INGREDIENTS.some(ing => ingredientNames.includes(ing))) {
    tags.add('high_protein');
  }
  
  // Vegetarian check (no meat ingredients)
  const hasMeat = MEAT_INGREDIENTS.some(meat => ingredientNames.includes(meat));
  if (!hasMeat) {
    tags.add('vegetarian');
  }
  
  // Protein types
  if (ingredientNames.includes("chicken")) tags.add('chicken');
  if (ingredientNames.includes("beef")) tags.add('beef');
  if (ingredientNames.includes("pork") || ingredientNames.includes("bacon")) {
    tags.add('pork');
  }
  if (ingredientNames.includes("fish") || ingredientNames.includes("salmon") || 
      ingredientNames.includes("tuna")) {
    tags.add('fish');
  }
  if (ingredientNames.includes("lamb")) tags.add('lamb');
  if (ingredientNames.includes("prawn") || ingredientNames.includes("shrimp")) {
    tags.add('seafood');
  }
  
  // Organic friendly (uses >50% organic-friendly ingredients)
  const organicCount = ORGANIC_FRIENDLY_INGREDIENTS.filter(ing => 
    ingredientNames.includes(ing)
  ).length;
  if (organicCount / recipe.ingredients.length > 0.5) {
    tags.add('organic_ok');
  }
  
  return tags;
}

/**
 * Deprecated - use standardizeRecipeTags instead
 */
export function inferTags(recipe: Recipe): string[] {
  return Array.from(inferTagsFromRecipe(recipe));
}

/**
 * Tag variation mappings - map common variations to standard tags
 */
const TAG_MAPPINGS: Record<string, string> = {
  // Kid friendly
  'kids': 'kid_friendly',
  'kid': 'kid_friendly',
  'family': 'kid_friendly',
  'family_friendly': 'kid_friendly',
  'child': 'kid_friendly',
  'children': 'kid_friendly',
  
  // Quick
  'fast': 'quick',
  'express': 'quick',
  '30_min': 'quick',
  '30_minute': 'quick',
  
  // Simple
  'easy': 'simple',
  'beginner': 'simple',
  
  // Bulk cook
  'batch': 'bulk_cook',
  'meal_prep': 'bulk_cook',
  'batch_cooking': 'bulk_cook',
  'leftovers': 'bulk_cook',
  
  // Vegetarian
  'veggie': 'vegetarian',
  'veg': 'vegetarian',
  
  // BBQ
  'barbecue': 'bbq',
  'grill': 'bbq',
  'grilled': 'bbq',
  
  // One pot
  'one_pan': 'one_pot',
  'single_pot': 'one_pot',
};

/**
 * Normalize a single tag to standard format
 * Returns null if tag is invalid or cannot be mapped
 */
function normalizeTag(tag: string): string | null {
  const lower = tag.toLowerCase().replace(/[_\s-]+/g, '_');
  
  // Check direct mapping
  if (TAG_MAPPINGS[lower]) {
    return TAG_MAPPINGS[lower];
  }
  
  // Check if it's already a valid tag
  if (VALID_TAG_SET.has(lower as RecipeTag)) {
    return lower;
  }
  
  // Check if tag contains a valid tag (e.g., "kid_friendly_dinner" → "kid_friendly")
  for (const validTag of VALID_TAGS) {
    if (lower.includes(validTag)) {
      return validTag;
  }
  }
  
  // Check if tag contains a mappable keyword
  for (const [key, value] of Object.entries(TAG_MAPPINGS)) {
    if (lower.includes(key)) {
      return value;
    }
  }
  
  // Invalid tag - discard
  return null;
}

/**
 * Deprecated - use standardizeRecipeTags instead
 */
export function normalizeTags(tags: string[]): string[] {
  const normalized = new Set<string>();
  
  for (const tag of tags) {
    const result = normalizeTag(tag);
    if (result) {
      normalized.add(result);
    }
  }
  
  return Array.from(normalized);
}

/**
 * Standardize all tags for a recipe
 * This is the main function to use for tag processing
 */
export function standardizeRecipeTags(recipe: Recipe): string[] {
  const finalTags = new Set<string>();
  
  // 1. Normalize existing tags from source
  for (const tag of recipe.tags) {
    const normalized = normalizeTag(tag);
    if (normalized) {
      finalTags.add(normalized);
    }
  }
  
  // 2. Infer additional tags from recipe data
  const inferred = inferTagsFromRecipe(recipe);
  for (const tag of inferred) {
    finalTags.add(tag);
  }
  
  // 3. Return sorted array of unique, valid tags
  return Array.from(finalTags).sort();
}

/**
 * Enhance recipe with clean, standardized tags
 * This is the public API for tag processing
 */
export function enhanceRecipeWithTags(recipe: Recipe): Recipe {
  return {
    ...recipe,
    tags: standardizeRecipeTags(recipe)
  };
}
