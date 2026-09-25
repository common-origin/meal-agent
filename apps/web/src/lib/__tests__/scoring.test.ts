import { describe, it, expect } from 'vitest';
import { scoreRecipe, scoreAndRank, SCORING_WEIGHTS, type ScoringContext } from '../scoring';
import type { Recipe, Household, Ingredient } from '../types/recipe';

function makeIngredient(name: string, overrides: Partial<Ingredient> = {}): Ingredient {
  return { name, qty: 100, unit: 'g', ...overrides };
}

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'recipe-1',
    title: 'Test Recipe',
    source: {
      url: 'https://example.com/recipe-1',
      domain: 'example.com',
      chef: 'Test Chef',
      license: 'permitted',
      fetchedAt: '2026-01-01T00:00:00.000Z',
    },
    timeMins: 30,
    tags: ['kid_friendly'],
    ingredients: [makeIngredient('chicken breast'), makeIngredient('rice')],
    serves: 4,
    ...overrides,
  };
}

function makeHousehold(overrides: Partial<Household> = {}): Household {
  return {
    id: 'household-1',
    members: { adults: 2, kids: 2 },
    diet: { glutenLight: false, highProtein: false, organicPreferred: false },
    retailer: 'coles',
    pantry: [],
    favorites: [],
    ...overrides,
  };
}

function makeContext(overrides: Partial<ScoringContext> = {}): ScoringContext {
  return {
    household: makeHousehold(),
    isWeekend: true,
    selectedRecipes: [],
    usedProteinTypes: {},
    ingredientCounts: {},
    recentRecipeIds: [],
    ...overrides,
  };
}

describe('scoreRecipe', () => {
  it('gives a plain recipe the base score with no bonuses or penalties', () => {
    const result = scoreRecipe(makeRecipe(), makeContext());

    expect(result.score).toBe(100);
    expect(result.bonuses).toEqual([]);
    expect(result.penalties).toEqual([]);
  });

  describe('hard filters', () => {
    it('zeroes out a recipe over 40 minutes on a weeknight', () => {
      const recipe = makeRecipe({ timeMins: 45 });
      const context = makeContext({ isWeekend: false });

      const result = scoreRecipe(recipe, context);

      expect(result.score).toBe(0);
      expect(result.reasons).toContain('Failed weeknight time constraint (>40min)');
    });

    it('does not apply the weeknight time limit on weekends', () => {
      const recipe = makeRecipe({ timeMins: 90 });
      const context = makeContext({ isWeekend: true });

      const result = scoreRecipe(recipe, context);

      expect(result.score).toBeGreaterThan(0);
    });

    it('zeroes out a non-kid-friendly recipe on a weeknight when the household needs it', () => {
      const recipe = makeRecipe({ tags: ['beef'] });
      const context = makeContext({
        isWeekend: false,
        household: makeHousehold({ diet: { glutenLight: true, highProtein: false, organicPreferred: false } }),
      });

      const result = scoreRecipe(recipe, context);

      expect(result.score).toBe(0);
      expect(result.reasons).toContain('Failed kid-friendly requirement');
    });

    it('does not require kid-friendly when the household diet flag is off', () => {
      const recipe = makeRecipe({ tags: ['beef'] });
      const context = makeContext({
        isWeekend: false,
        household: makeHousehold({ diet: { glutenLight: false, highProtein: false, organicPreferred: false } }),
      });

      const result = scoreRecipe(recipe, context);

      expect(result.score).toBeGreaterThan(0);
    });
  });

  describe('bonuses', () => {
    it('applies the favorite bonus when the recipe is in household favorites', () => {
      const recipe = makeRecipe({ id: 'fav-recipe' });
      const context = makeContext({ household: makeHousehold({ favorites: ['fav-recipe'] }) });

      const result = scoreRecipe(recipe, context);

      expect(result.score).toBe(100 + SCORING_WEIGHTS.FAVORITE_BONUS);
      expect(result.reasons).toContain('favorite');
    });

    it('applies the user-added bonus for custom-/ai- prefixed IDs', () => {
      const customResult = scoreRecipe(makeRecipe({ id: 'custom-123' }), makeContext());
      const aiResult = scoreRecipe(makeRecipe({ id: 'ai-456' }), makeContext());
      const plainResult = scoreRecipe(makeRecipe({ id: 'plain-789' }), makeContext());

      expect(customResult.score).toBe(100 + SCORING_WEIGHTS.USER_ADDED_BONUS);
      expect(aiResult.score).toBe(100 + SCORING_WEIGHTS.USER_ADDED_BONUS);
      expect(plainResult.score).toBe(100);
    });

    it('applies an ingredient reuse bonus per matched ingredient', () => {
      // normalizeIngredientName keeps the ingredient's first two words, so
      // the context keys need to match that normalized form exactly.
      const recipe = makeRecipe({
        ingredients: [makeIngredient('chicken breast'), makeIngredient('broccoli')],
      });
      const context = makeContext({
        ingredientCounts: { 'chicken breast': 1, broccoli: 1 },
      });

      const result = scoreRecipe(recipe, context);

      expect(result.score).toBe(100 + SCORING_WEIGHTS.INGREDIENT_REUSE_BONUS_PER_MATCH * 2);
      expect(result.reasons).toContain('reuses ingredients');
    });

    it('applies a cost value bonus scaled by how far under $4/serve the recipe is', () => {
      const cheap = scoreRecipe(makeRecipe({ costPerServeEst: 2 }), makeContext());
      const pricier = scoreRecipe(makeRecipe({ costPerServeEst: 3.5 }), makeContext());
      const atThreshold = scoreRecipe(makeRecipe({ costPerServeEst: 4 }), makeContext());

      expect(cheap.score).toBeGreaterThan(pricier.score);
      expect(pricier.score).toBeGreaterThan(100);
      expect(atThreshold.score).toBe(100); // no bonus at/above the $4 threshold
      expect(cheap.reasons).toContain('best value');
    });

    it('applies the bulk cook bonus for bulk_cook tagged recipes', () => {
      const result = scoreRecipe(makeRecipe({ tags: ['kid_friendly', 'bulk_cook'] }), makeContext());

      expect(result.score).toBe(100 + SCORING_WEIGHTS.BULK_COOK_BONUS);
      expect(result.reasons).toContain('bulk cook');
    });

    it('applies the high protein bonus only when both the household wants it and the recipe is tagged', () => {
      const recipe = makeRecipe({ tags: ['kid_friendly', 'high_protein'] });
      const wantsHighProtein = makeContext({
        household: makeHousehold({ diet: { glutenLight: false, highProtein: true, organicPreferred: false } }),
      });
      const doesNotWant = makeContext();

      expect(scoreRecipe(recipe, wantsHighProtein).score).toBe(100 + SCORING_WEIGHTS.HIGH_PROTEIN_BONUS);
      expect(scoreRecipe(recipe, doesNotWant).score).toBe(100);
    });

    it('applies the organic bonus only when both the household wants it and the recipe is tagged', () => {
      const recipe = makeRecipe({ tags: ['kid_friendly', 'organic_ok'] });
      const wantsOrganic = makeContext({
        household: makeHousehold({ diet: { glutenLight: false, highProtein: false, organicPreferred: true } }),
      });

      expect(scoreRecipe(recipe, wantsOrganic).score).toBe(100 + SCORING_WEIGHTS.ORGANIC_FRIENDLY_BONUS);
      expect(scoreRecipe(recipe, makeContext()).score).toBe(100);
    });

    it('applies the preferred chef bonus when the recipe matches', () => {
      const recipe = makeRecipe({ source: { ...makeRecipe().source, chef: 'Nigella Lawson' } });
      const context = makeContext({ preferredChef: 'Nigella Lawson' });

      const result = scoreRecipe(recipe, context);

      expect(result.score).toBe(100 + SCORING_WEIGHTS.SAME_CHEF_BONUS);
    });
  });

  describe('penalties', () => {
    it('applies the recent recipe penalty', () => {
      const recipe = makeRecipe({ id: 'recent-recipe' });
      const context = makeContext({ recentRecipeIds: ['recent-recipe'] });

      const result = scoreRecipe(recipe, context);

      expect(result.score).toBe(100 - SCORING_WEIGHTS.RECENT_RECIPE_PENALTY);
    });

    it('scales the protein repetition penalty by prior uses of that protein', () => {
      const recipe = makeRecipe({ tags: ['kid_friendly', 'chicken'] });
      const usedOnce = makeContext({ usedProteinTypes: { chicken: 1 } });
      const usedTwice = makeContext({ usedProteinTypes: { chicken: 2 } });

      expect(scoreRecipe(recipe, usedOnce).score).toBe(
        100 - SCORING_WEIGHTS.PROTEIN_REPETITION_PENALTY_PER_USE
      );
      expect(scoreRecipe(recipe, usedTwice).score).toBe(
        100 - SCORING_WEIGHTS.PROTEIN_REPETITION_PENALTY_PER_USE * 2
      );
    });

    it('applies a complexity penalty only past 12 ingredients', () => {
      // Distinct, non-numeric names — normalizeIngredientName strips digits,
      // so "ingredient-0".."ingredient-11" would all collapse to the same
      // string and trigger the (unrelated) pack-reuse bonus instead.
      const names = [
        'flour', 'sugar', 'butter', 'egg', 'milk', 'vanilla', 'baking powder',
        'salt', 'cinnamon', 'nutmeg', 'cocoa', 'yeast', 'olive oil', 'garlic', 'onion',
      ];
      const twelveIngredients = names.slice(0, 12).map(name => makeIngredient(name));
      const fifteenIngredients = names.slice(0, 15).map(name => makeIngredient(name));

      const atThreshold = scoreRecipe(makeRecipe({ ingredients: twelveIngredients }), makeContext());
      const overThreshold = scoreRecipe(makeRecipe({ ingredients: fifteenIngredients }), makeContext());

      expect(atThreshold.score).toBe(100);
      expect(overThreshold.score).toBe(100 - 3 * SCORING_WEIGHTS.COMPLEXITY_PENALTY_PER_INGREDIENT);
    });

    it('never returns a negative score', () => {
      const recipe = makeRecipe({ id: 'recent-recipe', tags: ['kid_friendly', 'chicken'] });
      const context = makeContext({
        recentRecipeIds: ['recent-recipe'],
        usedProteinTypes: { chicken: 10 },
      });

      const result = scoreRecipe(recipe, context);

      expect(result.score).toBe(0);
    });
  });

  describe('reasons', () => {
    it('flags quick recipes with a time-based reason', () => {
      expect(scoreRecipe(makeRecipe({ timeMins: 25 }), makeContext()).reasons).toContain('≤30m');
      expect(scoreRecipe(makeRecipe({ timeMins: 38 }), makeContext()).reasons).toContain('≤40m');
      expect(scoreRecipe(makeRecipe({ timeMins: 55 }), makeContext()).reasons).not.toContain('≤30m');
    });

    it('flags kid-friendly recipes', () => {
      const result = scoreRecipe(makeRecipe({ tags: ['kid_friendly'] }), makeContext());

      expect(result.reasons).toContain('kid-friendly');
    });

    it('deduplicates reasons', () => {
      // Both the ingredient-reuse path and the pack-reuse path can push
      // "best value" independently; the explanation should only list it once.
      const recipe = makeRecipe({
        costPerServeEst: 1,
        ingredients: [makeIngredient('chicken breast'), makeIngredient('chicken breast')],
      });
      const context = makeContext({ ingredientCounts: { chicken: 1 } });

      const result = scoreRecipe(recipe, context);
      const bestValueCount = result.reasons.filter(r => r === 'best value').length;

      expect(bestValueCount).toBe(1);
    });
  });
});

describe('scoreAndRank', () => {
  it('filters out hard-failed (zero score) candidates', () => {
    const kept = makeRecipe({ id: 'keeps', timeMins: 30, tags: ['kid_friendly'] });
    const dropped = makeRecipe({ id: 'drops', timeMins: 60, tags: ['kid_friendly'] });
    const context = makeContext({ isWeekend: false });

    const ranked = scoreAndRank([kept, dropped], context);

    expect(ranked).toHaveLength(1);
    expect(ranked[0].recipe.id).toBe('keeps');
  });

  it('sorts candidates by score descending', () => {
    const low = makeRecipe({ id: 'low', costPerServeEst: undefined });
    const high = makeRecipe({ id: 'high', costPerServeEst: 1 });
    const context = makeContext({ household: makeHousehold({ favorites: ['high'] }) });

    const ranked = scoreAndRank([low, high], context);

    expect(ranked[0].recipe.id).toBe('high');
    expect(ranked[0].explanation.score).toBeGreaterThan(ranked[1].explanation.score);
  });

  it('respects the topN limit', () => {
    const recipes = Array.from({ length: 5 }, (_, i) => makeRecipe({ id: `recipe-${i}` }));
    const context = makeContext();

    const ranked = scoreAndRank(recipes, context, 2);

    expect(ranked).toHaveLength(2);
  });

  it('returns an empty array when every candidate is hard-filtered out', () => {
    const recipes = [makeRecipe({ timeMins: 60 }), makeRecipe({ timeMins: 90 })];
    const context = makeContext({ isWeekend: false });

    expect(scoreAndRank(recipes, context)).toEqual([]);
  });
});
