/**
 * The one AI-output-to-Recipe normaliser (#84), used by generation, the
 * recipe photo and URL import.
 */

import type { Recipe } from '@/lib/types/recipe';
import { enhanceRecipeWithTags } from '@/lib/tagNormalizer';
import { estimateRecipeCost } from '@/lib/recipeCost';
import type { AiRecipe, ExtractedRecipe, PhotoIngredients } from './schemas';

export type RecipeOrigin = 'ai-generated' | 'user-added';

export interface ToRecipeExtras {
  /** Page the recipe came from (URL import). */
  sourceUrl?: string;
  /** Overrides the source shown for a user-added recipe. */
  sourceDomain?: string;
  /** When the recipe was fetched or generated; defaults to now. */
  fetchedAt?: string;
}

export function toRecipe(ai: AiRecipe | ExtractedRecipe, origin: RecipeOrigin, extras: ToRecipeExtras = {}): Recipe {
  const fetchedAt = extras.fetchedAt ?? new Date().toISOString();
  const extractedSource = 'source' in ai ? ai.source : undefined;

  const recipe: Recipe = {
    id: recipeId(ai.title, origin === 'ai-generated' ? 'ai' : 'import'),
    title: ai.title,
    source:
      origin === 'ai-generated'
        ? { url: '', domain: 'ai-generated', chef: 'AI Generated', license: 'unknown', fetchedAt }
        : {
            url: extras.sourceUrl ?? '',
            domain: extras.sourceDomain ?? (extras.sourceUrl ? hostOf(extras.sourceUrl) : 'user-added'),
            chef: extractedSource ?? '',
            license: 'unknown',
            fetchedAt,
          },
    timeMins: ai.totalTimeMins,
    serves: ai.servings,
    cuisine: ai.cuisine,
    tags: ai.tags,
    ingredients: toIngredients(ai.ingredients),
    instructions: ai.instructions,
    nutrition: ai.nutrition.calories > 0 ? ai.nutrition : undefined,
  };

  return finish(recipe);
}

/**
 * A user-added recipe with ingredients but no method: the cookbook photo
 * fallback after a copyright block (#92). The household adds the method.
 */
export function toPartialRecipe(partial: PhotoIngredients, extras: Pick<ToRecipeExtras, 'fetchedAt'> = {}): Recipe {
  const title = partial.title ?? '';
  return finish({
    id: recipeId(title, 'import'),
    title,
    source: {
      url: '',
      domain: 'user-added',
      chef: partial.source ?? '',
      license: 'unknown',
      fetchedAt: extras.fetchedAt ?? new Date().toISOString(),
    },
    serves: partial.servings,
    tags: [],
    ingredients: toIngredients(partial.ingredients),
    instructions: [],
  });
}

function toIngredients(ingredients: AiRecipe['ingredients']): Recipe['ingredients'] {
  return ingredients.map(({ name, qty, unit, prep }) => ({ name, qty, unit, ...(prep ? { prep } : {}) }));
}

function finish(recipe: Recipe): Recipe {
  const withTags = enhanceRecipeWithTags(recipe);
  return { ...withTags, costPerServeEst: estimateRecipeCost(withTags).perServe };
}

/**
 * Unique, readable recipe IDs (#90): `<prefix>-<slug(title) up to 40>-<8 hex>`.
 * The random suffix stops two recipes with the same title colliding.
 */
export function recipeId(title: string, prefix = 'ai'): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/g, '') || 'recipe';
  return `${prefix}-${slug}-${crypto.randomUUID().slice(0, 8)}`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'user-added';
  }
}
