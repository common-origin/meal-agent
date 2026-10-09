/**
 * Recipe cost from Coles prices (#89): the same per-ingredient pricing the
 * shopping list uses, instead of a number the model invents.
 */

import type { Recipe } from './types/recipe';
import { estimateIngredientCost } from './colesMapping';
import { normalizeIngredientName } from './shoppingListAggregator';

const DEFAULT_SERVES = 4;

export interface RecipeCost {
  total: number;
  perServe: number;
  /** Share of ingredients priced from a Coles mapping (0–1); the rest use category estimates. */
  pricedFraction: number;
}

export function estimateRecipeCost(recipe: Pick<Recipe, 'ingredients' | 'serves'>): RecipeCost {
  let total = 0;
  let priced = 0;
  for (const ingredient of recipe.ingredients) {
    const estimate = estimateIngredientCost(normalizeIngredientName(ingredient.name), ingredient.qty, ingredient.unit);
    total += estimate.estimatedCost;
    if (estimate.mapped) priced += 1;
  }
  const serves = recipe.serves && recipe.serves > 0 ? recipe.serves : DEFAULT_SERVES;
  return {
    total: roundCents(total),
    perServe: roundCents(total / serves),
    pricedFraction: recipe.ingredients.length > 0 ? priced / recipe.ingredients.length : 0,
  };
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}
