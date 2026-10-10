/**
 * Taste and history signals for AI generation (#88)
 *
 * Turns the household's recent meals, ratings, blocks, favourites and own
 * recipes into three short title lists for the generation prompt. Titles,
 * not IDs: an ID means nothing to the model. Pure, so the plan page passes
 * in everything it reads from storage.
 */

import type { Recipe } from './types/recipe';
import type { RecipeRating } from './storage';

export const MAX_RECENT_MEAL_TITLES = 15;
export const MAX_DISLIKED_MEAL_TITLES = 10;
export const MAX_LOVED_MEAL_TITLES = 12;
/** Matches the per-item cap in generateRecipesSchema. */
export const MAX_MEAL_TITLE_LENGTH = 100;

export interface TasteSignals {
  recentMealTitles: string[];
  dislikedMealTitles: string[];
  lovedMealTitles: string[];
}

export interface TasteSignalInputs {
  /** Recipe IDs in the current week's plan, in day order. */
  plan: string[];
  /** From recencyTracker.getRecentRecipeIds(), most recent first. */
  recentIds: string[];
  ratings: Record<string, RecipeRating>;
  /** In the order they were favourited (oldest first), as storage keeps them. */
  favorites: string[];
  /** In the order they were blocked (oldest first), as storage keeps them. */
  blockedIds: string[];
  library: {
    getById(id: string): Recipe | undefined;
    getCustomRecipes(): Recipe[];
  };
}

function clip(text: string, max = MAX_MEAL_TITLE_LENGTH): string {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
}

function withCuisine(recipe: Recipe): string {
  if (!recipe.cuisine) return clip(recipe.title);
  const suffix = ` (${recipe.cuisine})`;
  return clip(recipe.title, MAX_MEAL_TITLE_LENGTH - suffix.length) + suffix;
}

/** Titles for `ids` in order, skipping unknown recipes and repeated titles, up to `max`. */
function titlesFor(
  ids: string[],
  library: TasteSignalInputs['library'],
  max: number,
  format: (recipe: Recipe) => string = (recipe) => clip(recipe.title)
): string[] {
  const titles: string[] = [];
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  for (const id of ids) {
    if (titles.length >= max) break;
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    const recipe = library.getById(id);
    if (!recipe?.title) continue;
    const key = recipe.title.trim().toLowerCase();
    if (seenTitles.has(key)) continue;
    seenTitles.add(key);
    titles.push(format(recipe));
  }
  return titles;
}

function ratedIds(ratings: Record<string, RecipeRating>, keep: (rating: number) => boolean): string[] {
  return Object.values(ratings)
    .filter((r) => keep(r.rating))
    .sort((a, b) => b.ratedAt.localeCompare(a.ratedAt))
    .map((r) => r.recipeId);
}

export function buildTasteSignals({
  plan,
  recentIds,
  ratings,
  favorites,
  blockedIds,
  library,
}: TasteSignalInputs): TasteSignals {
  // Most recently blocked first, then recent low ratings. Blocking is the
  // stronger signal and has no timestamp of its own.
  const dislikedIds = [...[...blockedIds].reverse(), ...ratedIds(ratings, (r) => r <= 2)];
  const disliked = new Set(dislikedIds);

  // Favourites, ratings and the household's own recipes don't share a
  // timestamp, so each source is ordered newest first and the explicit
  // signals come first: favourites, then 4–5 star ratings, then own recipes.
  const ownRecipeIds = library
    .getCustomRecipes()
    .filter((r) => r.source?.domain === 'user-added')
    .sort((a, b) => (b.source.fetchedAt ?? '').localeCompare(a.source.fetchedAt ?? ''))
    .map((r) => r.id);
  const lovedIds = [...[...favorites].reverse(), ...ratedIds(ratings, (r) => r >= 4), ...ownRecipeIds].filter(
    (id) => !disliked.has(id)
  );

  return {
    recentMealTitles: titlesFor([...plan, ...recentIds], library, MAX_RECENT_MEAL_TITLES),
    dislikedMealTitles: titlesFor(dislikedIds, library, MAX_DISLIKED_MEAL_TITLES),
    lovedMealTitles: titlesFor(lovedIds, library, MAX_LOVED_MEAL_TITLES, withCuisine),
  };
}
