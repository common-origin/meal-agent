import { describe, it, expect } from 'vitest';
import { formatPlanSummary, summarisePlan } from '../planSummary';
import type { Recipe } from '../types/recipe';

const recipe = (overrides: Partial<Recipe> = {}): Recipe => ({
  id: 'r',
  title: 'R',
  source: { url: '', domain: 'ai-generated', chef: '', license: 'unknown', fetchedAt: '2026-10-19T00:00:00Z' },
  tags: [],
  ingredients: [{ name: 'chicken thigh', qty: 800, unit: 'g' }],
  serves: 4,
  costPerServeEst: 5,
  nutrition: { calories: 500, protein: 30, carbs: 40, fat: 20 },
  ...overrides,
});

describe('summarisePlan (#38)', () => {
  it('totals cost, budgets per dinner and averages nutrition per serve', () => {
    const summary = summarisePlan(
      [recipe(), recipe({ costPerServeEst: 4, serves: 2, nutrition: { calories: 700, protein: 40, carbs: 61, fat: 25 } })],
      20
    );
    expect(summary).toMatchObject({
      cost: 28,
      budget: 40,
      dinners: 2,
      nutrition: { calories: 600, protein: 35, carbs: 51, fat: 23, meals: 2 },
    });
  });

  it('averages nutrition only over meals that have it', () => {
    const summary = summarisePlan([recipe(), recipe({ nutrition: undefined }), recipe({ nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 } })], 20);
    expect(summary.nutrition).toMatchObject({ calories: 500, meals: 1 });
    expect(summarisePlan([recipe({ nutrition: undefined })], 20).nutrition).toBeNull();
  });

  it('flags a rough cost when too little is matched to Coles prices (#89)', () => {
    const unpriced = recipe({ ingredients: [{ name: 'dragonfruit essence', qty: 1, unit: 'unit' }] });
    expect(summarisePlan([unpriced], 20).roughCost).toBe(true);
    expect(summarisePlan([recipe()], 20).roughCost).toBe(false);
  });

  it('handles an empty plan', () => {
    expect(summarisePlan([], 20)).toEqual({ cost: 0, budget: 0, dinners: 0, roughCost: false, nutrition: null });
  });
});

describe('formatPlanSummary (#38)', () => {
  it('reads as one line, marking a rough cost with ~', () => {
    expect(formatPlanSummary({ cost: 117.6, budget: 140, dinners: 7, roughCost: false, nutrition: { calories: 520, protein: 0, carbs: 0, fat: 0, meals: 7 } })).toBe(
      '$118 of $140 · 7 dinners · ~520 kcal avg'
    );
    expect(formatPlanSummary({ cost: 18, budget: 20, dinners: 1, roughCost: true, nutrition: null })).toBe('~$18 of $20 · 1 dinner');
  });
});
