/**
 * Application-wide constants
 * Central location for configuration values used across the meal planning system
 */

// ============================================
// MEAL PLANNING DEFAULTS
// ============================================

/**
 * Default number of dinners to plan per week
 */
export const DEFAULT_DINNERS_PER_WEEK = 5;

/**
 * Maximum number of dinners that can be planned per week
 */
export const MAX_DINNERS_PER_WEEK = 7;

/**
 * Default number of servings per meal
 */
export const DEFAULT_SERVINGS_PER_MEAL = 4;

/**
 * Saturday and Sunday are considered weekends (day index >= 5)
 */
export const WEEKEND_START_DAY_INDEX = 5;

/**
 * Default cost estimate per serving in AUD
 */
export const DEFAULT_COST_PER_SERVING = 8.5;

/**
 * Default total time for recipes without time information (in minutes)
 */
export const DEFAULT_RECIPE_TIME_MINS = 30;

// ============================================
// RECIPE FILTERING & INDEXING
// ============================================

/**
 * Maximum total time (prep + cook) for recipes in minutes
 */
export const MAX_RECIPE_TIME_MINS = 60;

// ============================================
// API & PERFORMANCE
// ============================================

/**
 * API request timeout in milliseconds
 */
export const API_REQUEST_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Maximum number of API retry attempts
 */
export const API_MAX_RETRIES = 3;

/**
 * Initial delay for exponential backoff in milliseconds
 */
export const API_INITIAL_RETRY_DELAY_MS = 1000; // 1 second

/**
 * Debounce delay for text inputs in milliseconds
 */
export const DEBOUNCE_DELAY_MS = 300;

/**
 * Duration to show success messages in milliseconds
 */
export const SUCCESS_MESSAGE_DURATION_MS = 3000;

// ============================================
// STORAGE & CLEANUP
// ============================================

/**
 * Number of days before cleaning up temporary AI recipes
 */
export const TEMP_RECIPE_CLEANUP_DAYS = 30;

/**
 * Maximum number of ingredients allowed in a recipe
 */
export const MAX_RECIPE_INGREDIENTS = 18;

/**
 * Recipe categories to exclude when indexing
 */
export const EXCLUDED_RECIPE_CATEGORIES = [
  "Breakfast",
  "Brunch",
  "Dessert",
  "Baking",
  "Drinks",
  "Cocktails",
  "Snack",
  "Cupcake",
  "Sweet",
  "Cookie",
  "Brownie",
  "Cake",
  "Tart"
] as const;

/**
 * Keywords that indicate a recipe is dinner-focused
 */
export const DINNER_KEYWORDS = [
  "dinner",
  "main",
  "lunch",
  "entree",
  "entrée"
] as const;

/**
 * Protein types recognized in recipe selection
 */
export const PROTEIN_TYPES = [
  "chicken",
  "beef",
  "pork",
  "lamb",
  "fish",
  "seafood",
  "vegetarian"
] as const;

/**
 * Maximum number of suggested swaps to show
 */
export const MAX_SUGGESTED_SWAPS = 3;

// ============================================
// SCORING & COMPOSITION
// ============================================

/**
 * Repetition window - don't repeat recipes within this many weeks
 */
export const REPETITION_WINDOW_WEEKS = 3;

/**
 * Pack size reuse threshold - if ingredient appears this many times,
 * suggest larger pack size
 */
export const PACK_SIZE_MULTIPLIER = 1.5;

/**
 * Default number of candidates to score per day slot
 */
export const CANDIDATES_TO_SCORE_PER_SLOT = 10;

// ============================================
// TYPE EXPORTS
// ============================================

export type ProteinType = typeof PROTEIN_TYPES[number];
export type ExcludedCategory = typeof EXCLUDED_RECIPE_CATEGORIES[number];
export type DinnerKeyword = typeof DINNER_KEYWORDS[number];
