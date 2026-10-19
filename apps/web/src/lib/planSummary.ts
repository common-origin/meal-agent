/**
 * The plan page's one-line summary and its Details sheet (#38): cost against
 * budget, number of dinners, and average nutrition per serve.
 */

import type { NutritionInfo, Recipe } from './types/recipe';
import { planPricedFraction, ROUGH_ESTIMATE_THRESHOLD } from './recipeCost';

export interface PlanSummary {
  /** Sum of each meal's cost per serve × serves. */
  cost: number;
  /** Weekly budget: dinners × the household's max per meal. */
  budget: number;
  dinners: number;
  /** True when too little of the plan is matched to Coles prices to trust the figure (#89). */
  roughCost: boolean;
  /** Per serve, averaged over the meals that have nutrition; null when none do. */
  nutrition: (NutritionInfo & { meals: number }) | null;
}

export function summarisePlan(
  recipes: Pick<Recipe, 'ingredients' | 'serves' | 'costPerServeEst' | 'nutrition'>[],
  budgetPerMeal: number
): PlanSummary {
  const cost = recipes.reduce((sum, r) => sum + (r.costPerServeEst || 0) * (r.serves || 4), 0);
  const priced = planPricedFraction(recipes);
  const withNutrition = recipes.flatMap((r) => (r.nutrition && r.nutrition.calories > 0 ? [r.nutrition] : []));
  const average = (key: keyof NutritionInfo) =>
    Math.round(withNutrition.reduce((sum, n) => sum + n[key], 0) / withNutrition.length);

  return {
    cost,
    budget: recipes.length * budgetPerMeal,
    dinners: recipes.length,
    roughCost: priced !== null && priced < ROUGH_ESTIMATE_THRESHOLD,
    nutrition:
      withNutrition.length > 0
        ? {
            calories: average('calories'),
            protein: average('protein'),
            carbs: average('carbs'),
            fat: average('fat'),
            meals: withNutrition.length,
          }
        : null,
  };
}

/** e.g. "$118 of $140 · 7 dinners · ~520 kcal avg"; "~$" marks a rough cost. */
export function formatPlanSummary(summary: PlanSummary): string {
  const money = (value: number) => `$${Math.round(value)}`;
  const parts = [
    `${summary.roughCost ? '~' : ''}${money(summary.cost)} of ${money(summary.budget)}`,
    `${summary.dinners} ${summary.dinners === 1 ? 'dinner' : 'dinners'}`,
  ];
  if (summary.nutrition) parts.push(`~${summary.nutrition.calories} kcal avg`);
  return parts.join(' · ');
}
