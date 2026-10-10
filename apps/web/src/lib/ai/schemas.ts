/**
 * Response schemas for every AI task (#84). Each is sent to the model as
 * structured output (`Output.object`) and validated before a route sees it,
 * so nothing parses free-text JSON any more.
 *
 * Units are the app's existing five (the shopping list and Coles mapping
 * depend on them); the prompts tell the model how to convert into them.
 */

import { z } from 'zod';
import { INGREDIENT_UNITS } from '@/lib/types/recipe';
import { CUISINE_OPTIONS } from '@/lib/types/settings';
import { VALID_TAGS } from '@/lib/tagNormalizer';

const CUISINE_IDS = CUISINE_OPTIONS.map((option) => option.id) as [
  (typeof CUISINE_OPTIONS)[number]['id'],
  ...(typeof CUISINE_OPTIONS)[number]['id'][],
];

export const AiIngredient = z.object({
  name: z.string().min(1).max(60),
  qty: z.number().positive(),
  unit: z.enum(INGREDIENT_UNITS),
  prep: z.string().max(80).optional(),
});

const nonNegativeInt = z.number().int().min(0);

export const AiRecipe = z.object({
  title: z.string().min(1).max(80),
  cuisine: z.enum(CUISINE_IDS),
  totalTimeMins: z.number().int().min(5).max(240),
  servings: z.number().int().min(1).max(12),
  ingredients: z.array(AiIngredient).min(1).max(20),
  instructions: z.array(z.string().min(1)).min(2).max(12),
  tags: z.array(z.enum(VALID_TAGS)),
  /** Per serve. */
  nutrition: z.object({
    calories: nonNegativeInt,
    protein: nonNegativeInt,
    carbs: nonNegativeInt,
    fat: nonNegativeInt,
  }),
});

/** Recipe generation. (`whyThisMeal` arrives with #94; cost is computed, not asked for, per #89.) */
export const GeneratedRecipes = z.object({
  recipes: z.array(AiRecipe).min(1),
});

/** Recipe from a photo or a web page: the recipe plus where it came from, if shown. */
export const ExtractedRecipe = AiRecipe.extend({
  source: z.string().max(120).optional(),
});

/**
 * URL import with structured recipe data (#93): only the page's raw
 * ingredient lines, converted to the app's units. Title, steps, time and
 * servings come from the page itself.
 */
export const PageIngredients = z.object({
  ingredients: z.array(AiIngredient).max(40),
});

/** Cookbook photo (#92): the method is paraphrased in the model's own words, at most 10 steps. */
export const PhotoRecipe = ExtractedRecipe.extend({
  instructions: z.array(z.string().min(1)).min(2).max(10),
});

/** Cookbook photo fallback after a copyright (RECITATION) block (#92): facts only, no method. */
export const PhotoIngredients = z.object({
  title: z.string().min(1).max(80).optional(),
  servings: z.number().int().min(1).max(12).optional(),
  ingredients: z.array(AiIngredient).min(1).max(20),
  source: z.string().max(120).optional(),
});

/** Pantry/fridge photo scan (#91). */
export const PantryScan = z.object({
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(40),
        /** Visibly ripe or wilting produce, opened containers, fresh meat or fish. */
        useSoon: z.boolean(),
      })
    )
    .max(40),
});

export type AiIngredient = z.infer<typeof AiIngredient>;
export type AiRecipe = z.infer<typeof AiRecipe>;
export type ExtractedRecipe = z.infer<typeof ExtractedRecipe>;
export type PhotoIngredients = z.infer<typeof PhotoIngredients>;
export type PageIngredients = z.infer<typeof PageIngredients>;
