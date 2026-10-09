/**
 * A stored `recipes` row as a Recipe. Shared by client storage
 * (supabaseStorage.ts) and server routes (share-recipe-email), so a new
 * column is mapped in one place.
 */

import type { Recipe } from './types/recipe';
import type { Database } from './supabase/database.types';

export type RecipeRow = Database['public']['Tables']['recipes']['Row'];

/** Rows saved before #84 have no cuisine and no ingredient prep; both are optional, so they load unchanged. */
export function rowToRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    title: row.title,
    source: {
      url: row.source_url || '',
      domain: row.source_domain,
      chef: row.source_chef || '',
      license: 'unknown',
      fetchedAt: row.created_at,
    },
    timeMins: row.time_mins,
    serves: row.serves,
    tags: row.tags,
    ingredients: row.ingredients as Recipe['ingredients'],
    instructions: row.instructions || undefined,
    costPerServeEst: row.cost_per_serve_est || undefined,
    cuisine: row.cuisine ?? undefined,
    nutrition: (row.nutrition as Recipe['nutrition']) || undefined,
  };
}
