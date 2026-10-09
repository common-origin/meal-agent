import { describe, it, expect } from 'vitest';
import { estimateRecipeCost, planPricedFraction, planCostLabel, ROUGH_ESTIMATE_THRESHOLD } from '../recipeCost';
import { estimateIngredientCost } from '../colesMapping';
import type { Ingredient } from '../types/recipe';

const chicken: Ingredient = { name: 'chicken thigh', qty: 800, unit: 'g' };
const garlic: Ingredient = { name: 'garlic', qty: 4, unit: 'unit' };
const unmapped: Ingredient = { name: 'dragonfruit essence', qty: 1, unit: 'tsp' };

describe('estimateRecipeCost (#89)', () => {
  it('sums the same per-ingredient Coles estimates the shopping list uses', () => {
    const expected =
      estimateIngredientCost('chicken thigh', 800, 'g').estimatedCost +
      estimateIngredientCost('garlic', 4, 'unit').estimatedCost;
    const cost = estimateRecipeCost({ ingredients: [chicken, garlic], serves: 4 });
    expect(cost.total).toBeCloseTo(expected, 2);
    expect(cost.perServe).toBeCloseTo(expected / 4, 2);
  });

  it('normalises names first, so prep descriptors still find the mapping', () => {
    const plain = estimateRecipeCost({ ingredients: [chicken], serves: 4 });
    expect(plain.pricedFraction).toBe(1);
    const described = estimateRecipeCost({ ingredients: [{ ...chicken, name: 'Fresh chicken thigh, diced' }], serves: 4 });
    expect(described.total).toBe(plain.total);
  });

  it('lowers pricedFraction for ingredients without a Coles mapping', () => {
    expect(estimateIngredientCost('dragonfruit essence', 1, 'tsp').mapped).toBe(false);
    const allMapped = estimateRecipeCost({ ingredients: [chicken], serves: 4 });
    const someUnmapped = estimateRecipeCost({ ingredients: [chicken, unmapped], serves: 4 });
    expect(allMapped.pricedFraction).toBe(1);
    expect(someUnmapped.pricedFraction).toBe(0.5);
  });

  it.each([0, undefined])('defaults serves of %s to 4', (serves) => {
    const cost = estimateRecipeCost({ ingredients: [chicken], serves });
    expect(cost.perServe).toBeCloseTo(cost.total / 4, 2);
  });

  it('handles a recipe with no ingredients', () => {
    expect(estimateRecipeCost({ ingredients: [], serves: 4 })).toEqual({ total: 0, perServe: 0, pricedFraction: 0 });
  });
});

describe('planPricedFraction', () => {
  it('weights by ingredient count across the whole plan', () => {
    // 3 mapped + 1 unmapped across two recipes = 0.75
    const fraction = planPricedFraction([
      { ingredients: [chicken, garlic], serves: 4 },
      { ingredients: [chicken, unmapped], serves: 4 },
    ]);
    expect(fraction).toBe(0.75);
  });

  it('is null for a plan with nothing to price', () => {
    expect(planPricedFraction([])).toBeNull();
    expect(planPricedFraction([{ ingredients: [], serves: 4 }])).toBeNull();
  });
});

describe('planCostLabel', () => {
  it('says the estimate comes from Coles prices at or above the threshold', () => {
    expect(planCostLabel(1)).toBe('Estimated from Coles prices');
    expect(planCostLabel(ROUGH_ESTIMATE_THRESHOLD)).toBe('Estimated from Coles prices');
  });

  it('flags a rough estimate below 70% priced', () => {
    expect(planCostLabel(0.69)).toBe('Rough estimate: some ingredients unpriced');
    expect(planCostLabel(0)).toBe('Rough estimate: some ingredients unpriced');
  });

  it('uses the default label when there is nothing to price', () => {
    expect(planCostLabel(null)).toBe('Estimated from Coles prices');
  });
});
