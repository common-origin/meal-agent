import { describe, it, expect } from 'vitest';
import {
  buildTasteSignals,
  MAX_DISLIKED_MEAL_TITLES,
  MAX_LOVED_MEAL_TITLES,
  MAX_MEAL_TITLE_LENGTH,
  MAX_RECENT_MEAL_TITLES,
  type TasteSignalInputs,
} from '../tasteSignals';
import type { Recipe } from '../types/recipe';
import type { RecipeRating } from '../storage';

function recipe(id: string, overrides: Partial<Recipe> = {}): Recipe {
  return {
    id,
    title: `Title ${id}`,
    source: { url: '', domain: 'ai-generated', chef: '', license: 'unknown', fetchedAt: '2026-01-01T00:00:00.000Z' },
    tags: [],
    ingredients: [],
    ...overrides,
  };
}

function libraryOf(recipes: Recipe[], custom: Recipe[] = []): TasteSignalInputs['library'] {
  const byId = new Map([...recipes, ...custom].map((r) => [r.id, r]));
  return { getById: (id) => byId.get(id), getCustomRecipes: () => custom };
}

function rating(recipeId: string, value: number, day: number): RecipeRating {
  return { recipeId, rating: value, ratedAt: `2026-01-${String(day).padStart(2, '0')}T00:00:00.000Z` };
}

const empty: Omit<TasteSignalInputs, 'library'> = { plan: [], recentIds: [], ratings: {}, favorites: [], blockedIds: [] };
const many = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => recipe(`${prefix}${i}`));

describe('buildTasteSignals', () => {
  it('returns three empty lists with no history', () => {
    expect(buildTasteSignals({ ...empty, library: libraryOf([]) })).toEqual({
      recentMealTitles: [],
      dislikedMealTitles: [],
      lovedMealTitles: [],
    });
  });

  describe('recentMealTitles', () => {
    it("puts this week's meals first, then history in the order given, deduplicated", () => {
      const library = libraryOf([recipe('a'), recipe('b'), recipe('c')]);
      const { recentMealTitles } = buildTasteSignals({ ...empty, plan: ['b', 'a'], recentIds: ['c', 'a'], library });
      expect(recentMealTitles).toEqual(['Title b', 'Title a', 'Title c']);
    });

    it('dedupes recipes that share a title and skips unknown IDs', () => {
      const library = libraryOf([recipe('a', { title: 'Beef Tacos' }), recipe('b', { title: 'beef tacos ' })]);
      const { recentMealTitles } = buildTasteSignals({ ...empty, plan: ['missing', 'a'], recentIds: ['b'], library });
      expect(recentMealTitles).toEqual(['Beef Tacos']);
    });

    it(`caps at ${MAX_RECENT_MEAL_TITLES}`, () => {
      const recipes = many(30, 'r');
      const { recentMealTitles } = buildTasteSignals({ ...empty, recentIds: recipes.map((r) => r.id), library: libraryOf(recipes) });
      expect(recentMealTitles).toHaveLength(MAX_RECENT_MEAL_TITLES);
      expect(recentMealTitles[0]).toBe('Title r0');
    });
  });

  describe('dislikedMealTitles', () => {
    it('includes ratings of 2 stars or fewer, newest first, and not 3 stars', () => {
      const library = libraryOf([recipe('one'), recipe('two'), recipe('three')]);
      const ratings = { one: rating('one', 1, 1), two: rating('two', 2, 5), three: rating('three', 3, 9) };
      expect(buildTasteSignals({ ...empty, ratings, library }).dislikedMealTitles).toEqual(['Title two', 'Title one']);
    });

    it('counts blocked recipes as disliked, most recently blocked first, ahead of ratings', () => {
      const library = libraryOf([recipe('x'), recipe('y'), recipe('z')]);
      const { dislikedMealTitles } = buildTasteSignals({
        ...empty,
        blockedIds: ['x', 'y'],
        ratings: { z: rating('z', 1, 3), y: rating('y', 1, 4) },
        library,
      });
      expect(dislikedMealTitles).toEqual(['Title y', 'Title x', 'Title z']);
    });

    it(`caps at ${MAX_DISLIKED_MEAL_TITLES}`, () => {
      const recipes = many(15, 'd');
      const { dislikedMealTitles } = buildTasteSignals({ ...empty, blockedIds: recipes.map((r) => r.id), library: libraryOf(recipes) });
      expect(dislikedMealTitles).toHaveLength(MAX_DISLIKED_MEAL_TITLES);
    });
  });

  describe('lovedMealTitles', () => {
    it('orders favourites (newest first), then 4–5 star ratings (newest first), then own recipes', () => {
      const own = recipe('own', { source: { ...recipe('own').source, domain: 'user-added' } });
      const library = libraryOf([recipe('f1'), recipe('f2'), recipe('r4'), recipe('r5')], [own]);
      const { lovedMealTitles } = buildTasteSignals({
        ...empty,
        favorites: ['f1', 'f2'],
        ratings: { r5: rating('r5', 5, 1), r4: rating('r4', 4, 2) },
        library,
      });
      expect(lovedMealTitles).toEqual(['Title f2', 'Title f1', 'Title r4', 'Title r5', 'Title own']);
    });

    it('orders own recipes newest first and ignores custom recipes that are not user-added', () => {
      const own = (id: string, day: number) =>
        recipe(id, { source: { ...recipe(id).source, domain: 'user-added', fetchedAt: `2026-02-0${day}T00:00:00.000Z` } });
      const library = libraryOf([], [own('old', 1), own('new', 5), recipe('promoted-ai')]);
      expect(buildTasteSignals({ ...empty, library }).lovedMealTitles).toEqual(['Title new', 'Title old']);
    });

    it('adds the cuisine when known', () => {
      const library = libraryOf([recipe('k', { title: 'Chicken Katsu Curry', cuisine: 'japanese' }), recipe('p')]);
      const { lovedMealTitles } = buildTasteSignals({ ...empty, favorites: ['p', 'k'], library });
      expect(lovedMealTitles).toEqual(['Chicken Katsu Curry (japanese)', 'Title p']);
    });

    it('leaves out anything the household also disliked, and dedupes across sources', () => {
      const library = libraryOf([recipe('a'), recipe('b')]);
      const { lovedMealTitles } = buildTasteSignals({
        ...empty,
        favorites: ['a', 'b'],
        ratings: { a: rating('a', 5, 1), b: rating('b', 2, 2) },
        library,
      });
      expect(lovedMealTitles).toEqual(['Title a']);
    });

    it(`caps at ${MAX_LOVED_MEAL_TITLES}`, () => {
      const recipes = many(20, 'l');
      const { lovedMealTitles } = buildTasteSignals({ ...empty, favorites: recipes.map((r) => r.id), library: libraryOf(recipes) });
      expect(lovedMealTitles).toHaveLength(MAX_LOVED_MEAL_TITLES);
    });
  });

  it(`keeps every title within ${MAX_MEAL_TITLE_LENGTH} chars, cuisine suffix included`, () => {
    const long = recipe('long', { title: 'Slow-cooked '.repeat(20), cuisine: 'middle_eastern' });
    const signals = buildTasteSignals({ ...empty, plan: ['long'], favorites: ['long'], library: libraryOf([long]) });
    expect(signals.recentMealTitles[0].length).toBeLessThanOrEqual(MAX_MEAL_TITLE_LENGTH);
    expect(signals.lovedMealTitles[0].length).toBeLessThanOrEqual(MAX_MEAL_TITLE_LENGTH);
    expect(signals.lovedMealTitles[0]).toMatch(/… \(middle_eastern\)$/);
  });
});
