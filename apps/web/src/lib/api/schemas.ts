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
// Meal titles for the taste and history lines (#88), built by tasteSignals.ts.
const mealTitleList = z.array(z.string().max(100)).max(20).default([]);
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
  recentMealTitles: mealTitleList,
  dislikedMealTitles: mealTitleList,
  lovedMealTitles: mealTitleList,
  specificDays: specificDaysSchema.optional(),
  pantryItems: z.array(z.string().max(60)).max(60).default([]),
  existingProteins: textList.default([]),
  /** IANA zone from the browser (#87); unknown zones fall back to Australia/Melbourne. */
  timeZone: z.string().max(64).optional(),
});

export const extractRecipeFromUrlSchema = z.object({
  // Recipe URLs are often longer than the 100-char free-text cap. Which URLs
  // may be fetched is validated separately (#79).
  url: z.string().trim().min(1).max(2048),
});
