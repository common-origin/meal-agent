/**
 * Zod schemas for AI route request bodies.
 *
 * The length caps exist to stop prompt stuffing: client-supplied text goes
 * straight into Gemini prompts. Unknown keys are stripped (z.object's
 * default), so only fields listed here ever reach a prompt.
 */

import { z } from 'zod';
import { MAX_FLAVOR_PROFILE_LENGTH, MAX_SETTING_TEXT_LENGTH } from '@/lib/types/settings';

const text = z.string().max(MAX_SETTING_TEXT_LENGTH);
const textList = z.array(text).max(30);
// Recipe IDs aren't free text, and AI recipe IDs are derived from the full
// title (generateRecipeId), so they get a looser per-item cap than prose.
const recipeIdList = z.array(z.string().max(200)).max(30);
// Optional fields may arrive as null from stored settings; treat that as absent.
const optionalText = text.nullish().transform((v) => v ?? undefined);
const optionalTextList = textList.nullish().transform((v) => v ?? undefined);

export const familySettingsSchema = z.object({
  adults: z.number(),
  children: z.array(z.object({ age: z.number() })).max(30),
  totalServings: z.number(),

  cuisines: textList,
  customCuisines: optionalTextList,
  preferredChef: optionalText,

  dietaryType: z.enum(['omnivore', 'vegetarian', 'vegan', 'pescatarian', 'flexitarian']),
  glutenFreePreference: z.boolean(),
  dairyFree: z.boolean(),
  proteinFocus: z.boolean(),
  allergies: textList,
  avoidFoods: textList,
  favoriteIngredients: textList,

  spiceTolerance: z.enum(['very_mild', 'mild', 'medium', 'hot', 'loves_hot']),
  cookingSkill: z.enum(['beginner', 'intermediate', 'confident_home_cook', 'advanced']),
  effortPreference: z.enum(['minimal_clean_up', 'balanced', 'happy_to_spend_time_on_weekends']),
  flavorProfileDescription: z.string().max(MAX_FLAVOR_PROFILE_LENGTH),

  location: z.object({
    city: text,
    country: text,
    hemisphere: z.enum(['northern', 'southern']),
  }),

  dislikedRecipeIds: recipeIdList,
  dislikedPatterns: optionalTextList,

  budgetPerMeal: z.object({ min: z.number(), max: z.number() }),
  maxCookTime: z.object({ weeknight: z.number(), weekend: z.number() }),

  batchCooking: z.object({
    enabled: z.boolean(),
    frequency: z.enum(['weekly', 'biweekly', 'none']),
    preferredDay: z.enum(['sunday', 'saturday', 'friday']),
  }),
  varietyLevel: z.number(),
  leftoverFriendly: z.boolean(),
  pantryPreference: z.enum(['hard', 'soft']),
  weeklyReminderTime: optionalText,
  weeklyReminderDay: z
    .enum(['saturday', 'sunday', 'monday'])
    .nullish()
    .transform((v) => v ?? undefined),

  lastUpdated: text,
});

// Shape settled in #80: one entry per day being generated.
export const specificDaysSchema = z
  .array(
    z.object({
      index: z.number().int().min(0).max(6),
      type: z.enum(['weeknight', 'weekend']),
    })
  )
  .max(7);

export const generateRecipesSchema = z.object({
  familySettings: familySettingsSchema,
  numberOfRecipes: z.number().int().min(1).max(7).default(7),
  excludeRecipeIds: recipeIdList.default([]),
  specificDays: specificDaysSchema.optional(),
  pantryItems: z.array(z.string().max(60)).max(60).default([]),
  existingProteins: textList.default([]),
});

export const extractRecipeFromImageSchema = z.object({
  // Base64 data URL. Size is bounded by the platform's request limit (#82).
  image: z.string().min(1),
});

export const extractRecipeFromUrlSchema = z.object({
  // Recipe URLs are often longer than the 100-char free-text cap. Which URLs
  // may be fetched is validated separately (#79).
  url: z.string().trim().min(1).max(2048),
});
