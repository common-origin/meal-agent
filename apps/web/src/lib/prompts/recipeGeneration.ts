/**
 * AI Prompt Generation for Recipe Suggestions
 *
 * The system prompt holds stable rules (role, Australian supermarket
 * realism, flavour and technique, safety, output); the user prompt holds only
 * this household's facts and this request's constraints. Each rule appears
 * once (#87). The output shape itself is enforced by the response schema
 * (lib/ai/schemas.ts, #84).
 */

import { CUISINE_FORMAT_RULE, INGREDIENT_FORMAT_RULES } from './recipeFormat';
import { VALID_TAGS } from '../tagNormalizer';
import type { FamilySettings } from '../types/settings';
import { getCurrentSeason, getInSeasonIngredients, type Hemisphere } from '../seasonal';

export interface RecipeGenerationRequest {
  familySettings: FamilySettings;
  numberOfRecipes: number;
  /** Titles of this week's and recent meals, most recent first (#88). */
  recentMealTitles?: string[];
  /** Titles of meals rated 1–2 stars or blocked (#88). */
  dislikedMealTitles?: string[];
  /** The taste profile: favourites, 4–5 star meals and the household's own recipes, with cuisine (#88). */
  lovedMealTitles?: string[];
  specificDays?: { index: number; type: 'weeknight' | 'weekend' }[]; // If generating specific days (shape settled in #80)
  pantryItems?: string[]; // Ingredients already available
  existingProteins?: string[]; // Proteins already in the week plan (for single recipe variety)
  /** IANA time zone the household plans in; month and season are computed there. */
  timeZone?: string;
}

/** Used when the client sends no time zone, or one the runtime doesn't know. */
export const DEFAULT_TIME_ZONE = 'Australia/Melbourne';

/** `timeZone` if the runtime accepts it, otherwise the default. */
export function resolveTimeZone(timeZone: string | undefined): string {
  if (!timeZone) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('en-AU', { timeZone });
    return timeZone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/** The current month in `timeZone`: index 0-11 and its English name. */
export function monthInTimeZone(timeZone: string, now: Date = new Date()): { index: number; name: string } {
  const zone = resolveTimeZone(timeZone);
  const index = Number(new Intl.DateTimeFormat('en-AU', { timeZone: zone, month: 'numeric' }).format(now)) - 1;
  const name = new Intl.DateTimeFormat('en-AU', { timeZone: zone, month: 'long' }).format(now);
  return { index, name };
}

/**
 * Get alternative protein suggestions based on what's already used
 */
function getAlternativeProteins(usedProteins: string[]): string[] {
  const allProteins = ['chicken', 'beef', 'pork', 'fish', 'lamb', 'seafood', 'tofu', 'lentils', 'beans'];
  return allProteins.filter(protein => !usedProteins.includes(protein));
}

/**
 * Build the system prompt: stable rules that don't depend on the household.
 */
export function buildSystemPrompt(): string {
  return `You are an experienced recipe developer writing dinners for Australian home cooks. Every recipe must be authentic, practical and genuinely delicious: something a family would cook again.

CUISINE
- Each recipe belongs to ONE clear cuisine and uses its traditional ingredients, techniques and flavour pairings.
- Fusion only for well-established dishes home cooks already make (e.g. Korean fried chicken burgers, banh mi). Never invent clashing combinations (e.g. laksa bolognese).

AUSTRALIAN SUPERMARKET REALISM
- Use only ingredients sold at Coles or Woolworths, named in Australian English: coriander, capsicum, beef mince, spring onion, zucchini, eggplant, prawns, rockmelon.
- Size quantities to common packs to avoid waste: 500 g mince, 600–800 g chicken, 400 g cans, 270 ml coconut milk, 300 ml cream, whole onions and heads of broccoli, one bunch of herbs.
- Avoid specialty-store-only ingredients, several tiny amounts of different fresh herbs, and restaurant components. Offer an easy substitute for anything hard to find (e.g. dry sherry for Chinese rice wine).

FLAVOUR AND TECHNIQUE
- Build flavour in layers: aromatics, bloomed spices, well-browned protein, deglazing, seasoning at several stages, and a fresh finish (herbs, citrus, acid).
- Balance salt, fat, acid, sweetness and umami for the cuisine, with texture contrast where it suits.
- Match technique to cuisine: high-heat wok for stir-fries, gentle simmers for Italian sauces, bloomed spices for curries, charring for Mexican.

INSTRUCTIONS
- 5–7 steps. Step 1 is prep and setup: preheat, specific cuts, anything to start ahead.
- Give specific heat, timings and visual or texture cues ("medium-high heat, 4–5 minutes, until golden"), a brief reason where it helps ("brown in batches so it sears rather than steams"), when to taste and adjust, and any resting time.
- Fit tasks together where you can ("while the sauce simmers, cook the pasta").

INGREDIENTS
- 8–12 ingredients per recipe (never fewer than 8), not counting salt, pepper and cooking oil: enough for a complete, balanced dinner with a sauce or seasoning and a vegetable.

${INGREDIENT_FORMAT_RULES}

SAFETY
- Proteins must be safely cooked within the stated time, starches properly cooked, and the total time realistic.
- Keep salt and sugar at sensible levels per person.

OUTPUT
- Return only the JSON the response schema describes.
${CUISINE_FORMAT_RULE}
- "tags" may only use: ${VALID_TAGS.join(', ')}.
- "totalTimeMins" is the total time including prep.
- "nutrition" is a realistic per-serve estimate in kcal and grams, as whole numbers; a typical dinner is 350–700 kcal.`;
}

const DIET_DESCRIPTIONS: Record<string, string> = {
  flexitarian: 'mostly plant-based; vegetarian for most meals, meat or fish at most 1–2 times a week',
  pescatarian: 'no meat (beef, pork, chicken, lamb); fish, seafood, dairy and eggs are fine',
  vegetarian: 'no meat or fish; dairy and eggs are fine; use legumes, tofu and eggs for protein',
  vegan: 'no animal products at all (no meat, fish, dairy, eggs or honey); use tofu, tempeh, legumes or seitan',
};

const SPICE_DESCRIPTIONS = {
  very_mild: 'no spice at all',
  mild: 'mild heat only',
  medium: 'moderate heat is fine',
  hot: 'loves spicy food',
  loves_hot: 'loves extra hot food',
};

const SKILL_DESCRIPTIONS = {
  beginner: 'beginner: simple techniques, very clear instructions',
  intermediate: 'intermediate: standard home-cooking techniques',
  confident_home_cook: 'confident home cook: most techniques and multi-step recipes',
  advanced: 'advanced: enjoys a challenge',
};

const EFFORT_DESCRIPTIONS = {
  minimal_clean_up: 'minimal clean-up (favour one-pot meals and simple prep)',
  balanced: 'balanced (a few pots and pans is fine for a better result)',
  happy_to_spend_time_on_weekends: 'happy to spend longer on weekends',
};

/**
 * Build the user prompt: this household's facts and this request's constraints.
 */
export function buildRecipeGenerationPrompt(request: RecipeGenerationRequest): string {
  const { familySettings, numberOfRecipes, specificDays, pantryItems } = request;

  // Without specificDays this is a weeknight request: the full plan fills
  // Monday–Friday today. Per-day types for a 7-day plan come with #95.
  const dayType = specificDays?.[0]?.type ?? 'weeknight';
  const maxTime = dayType === 'weekend' ? familySettings.maxCookTime.weekend : familySettings.maxCookTime.weeknight;

  const children = familySettings.children;
  const people = children.length > 0
    ? `${familySettings.adults} adults, ${children.length} ${children.length === 1 ? 'child' : 'children'} aged ${children.map(c => c.age).join(', ')}`
    : `${familySettings.adults} adults`;

  const hemisphere = (familySettings.location?.hemisphere || 'southern') as Hemisphere;
  const place = familySettings.location?.city && familySettings.location?.country
    ? `${familySettings.location.city}, ${familySettings.location.country}`
    : 'Melbourne, Australia';
  const cuisines = familySettings.cuisines.length > 0 ? familySettings.cuisines.join(', ') : 'any';

  const lines: string[] = [`Generate ${numberOfRecipes} ${dayType} dinner recipes with these requirements:`];
  const section = (heading: string, items: string[]) => {
    if (items.length > 0) lines.push('', heading, ...items.map(item => `- ${item}`));
  };

  // Household
  const household = [
    `Servings: ${familySettings.totalServings} (${people}).`,
    `Location: ${place} (${hemisphere} hemisphere).`,
    `Cuisines: ${cuisines}. Each recipe uses one of these.`,
    `Spice: ${SPICE_DESCRIPTIONS[familySettings.spiceTolerance]}.`,
    `Cooking skill: ${SKILL_DESCRIPTIONS[familySettings.cookingSkill]}.`,
    `Effort: ${EFFORT_DESCRIPTIONS[familySettings.effortPreference]}.`,
  ];
  if (familySettings.flavorProfileDescription) household.push(`Flavour preferences: ${familySettings.flavorProfileDescription}.`);
  if (familySettings.preferredChef) {
    household.push(`Recipe inspiration: the approachable, home-cook style of ${familySettings.preferredChef} (not restaurant-level).`);
  }
  section('HOUSEHOLD', household);

  // Dietary
  const dietary: string[] = [];
  const diet = DIET_DESCRIPTIONS[familySettings.dietaryType];
  if (diet) dietary.push(`Diet: ${familySettings.dietaryType.toUpperCase()}, ${diet}.`);
  if (familySettings.allergies.length > 0) dietary.push(`MUST AVOID (allergies): ${familySettings.allergies.join(', ')}.`);
  if (familySettings.avoidFoods.length > 0) dietary.push(`Avoid: ${familySettings.avoidFoods.join(', ')}.`);
  if (familySettings.glutenFreePreference) dietary.push('Prefer gluten-free options (avoid wheat, barley, rye) where possible.');
  if (familySettings.dairyFree) dietary.push('Dairy-free: no milk, cheese, cream, butter or yoghurt; use plant-based alternatives.');
  if (familySettings.proteinFocus) dietary.push('High protein: at least 20 g per serve.');
  if (familySettings.favoriteIngredients.length > 0) {
    dietary.push(`Favourite ingredients to include where they suit: ${familySettings.favoriteIngredients.join(', ')}.`);
  }
  section('DIETARY', dietary);

  // Taste: what this household has loved and disliked before
  const taste: string[] = [];
  if (request.lovedMealTitles && request.lovedMealTitles.length > 0) {
    taste.push(
      `The household loves these. Use them as a guide to the flavours, styles and effort level they enjoy. Don't copy them: ${request.lovedMealTitles.join('; ')}.`
    );
  }
  if (request.dislikedMealTitles && request.dislikedMealTitles.length > 0) {
    taste.push(`The household disliked these. Avoid similar dishes: ${request.dislikedMealTitles.join('; ')}.`);
  }
  section('TASTE', taste);

  // Time and budget
  const timeAndBudget = [
    `Maximum cooking time: ${maxTime} minutes (total time including prep).`,
    `Budget per meal: $${familySettings.budgetPerMeal.min}-$${familySettings.budgetPerMeal.max}.`,
  ];
  if (familySettings.leftoverFriendly) timeAndBudget.push('Recipes should reheat well as leftovers.');
  if (familySettings.batchCooking.enabled) {
    timeAndBudget.push(`The family batch cooks ${familySettings.batchCooking.frequency}, so prefer recipes that scale and store well.`);
  }
  section('TIME AND BUDGET', timeAndBudget);

  // Kids: only when the household has children
  if (children.length > 0) {
    const ages = children.map(c => c.age);
    section(
      'KIDS',
      ages.some(age => age < 8)
        ? [
            `Kid-friendly for ages ${ages.join(', ')}: mild, not bitter or very complex, in familiar formats (pasta, rice bowls, mild sauces).`,
          ]
        : [`Suitable for children aged ${ages.join(', ')}.`]
    );
  }

  // Season, in the household's own time zone
  const month = monthInTimeZone(request.timeZone ?? DEFAULT_TIME_ZONE);
  const season = getCurrentSeason(hemisphere, month.index);
  const inSeason = getInSeasonIngredients(hemisphere, month.index);
  section('SEASON', [
    `It is ${month.name} (${season}) in ${place}.` +
      (inSeason.length > 0 ? ` In season now: ${inSeason.join(', ')}.` : ''),
    'Prefer in-season produce where it suits the cuisine; out-of-season ingredients are fine when needed.',
  ]);

  // Pantry
  if (pantryItems && pantryItems.length > 0) {
    section(
      'PANTRY',
      familySettings.pantryPreference === 'soft'
        ? [`Available if they fit naturally: ${pantryItems.join(', ')}. Never force a strange combination just to use them.`]
        : [`Already available, use as many as possible across the plan to reduce waste: ${pantryItems.join(', ')}.`]
    );
  }

  // Variety
  const variety: string[] = [];
  if (numberOfRecipes > 1) {
    variety.push(
      'Across the plan, mix the preferred cuisines, primary proteins (poultry, red meat, seafood, legumes, tofu), cooking methods (stir-fry, roast, grill, braise) and flavour profiles (e.g. not three tomato-based pastas).'
    );
  }
  if (request.recentMealTitles && request.recentMealTitles.length > 0) {
    variety.push(`Don't repeat or closely resemble these recent meals: ${request.recentMealTitles.join('; ')}.`);
  }
  if (request.existingProteins && request.existingProteins.length > 0 && numberOfRecipes === 1) {
    const used = [...new Set(request.existingProteins)];
    variety.push(
      `This week already includes ${used.join(', ')}. Choose a different protein, e.g. ${getAlternativeProteins(used).join(', ')}.`
    );
  }
  section('VARIETY', variety);

  return lines.join('\n');
}
