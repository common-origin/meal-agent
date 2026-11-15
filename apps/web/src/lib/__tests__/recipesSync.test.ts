import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Recipe } from '../types/recipe';

const recipe = (id: string, domain: string): Recipe =>
  ({ id, title: id, ingredients: [], instructions: [], tags: [], timeMins: 30, serves: 4, source: { domain, fetchedAt: new Date().toISOString() } }) as unknown as Recipe;

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' } as { id: string } | null,
  remote: [] as Recipe[] | null,
  loads: 0,
}));

vi.mock('../supabase/client', () => ({ getCurrentUser: async () => mocks.user }));
vi.mock('../supabaseStorage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../supabaseStorage')>()),
  loadAllRecipesFromDb: vi.fn(async () => {
    mocks.loads++;
    return mocks.remote;
  }),
}));

import { hydrateRecipesFromSupabase, resetRecipesHydrationForTests } from '../hybridStorage';
import { RecipeLibrary } from '../library';

beforeEach(() => {
  localStorage.clear();
  mocks.user = { id: 'user-1' };
  mocks.remote = [];
  mocks.loads = 0;
  resetRecipesHydrationForTests();
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('recipes sync (#233)', () => {
  it("puts the household's recipes in this browser, so they open here too", async () => {
    mocks.remote = [recipe('custom-1-soup', 'user-added'), recipe('ai-1-curry', 'ai-generated')];
    expect(RecipeLibrary.getById('custom-1-soup')).toBeUndefined();
    expect(await hydrateRecipesFromSupabase()).toBe(true);
    expect(RecipeLibrary.getById('custom-1-soup')?.title).toBe('custom-1-soup');
    expect(RecipeLibrary.getById('ai-1-curry')?.title).toBe('ai-1-curry');
  });

  it("leaves the cache alone when Supabase can't be read", async () => {
    mocks.remote = [recipe('ai-1-curry', 'ai-generated')];
    await hydrateRecipesFromSupabase();
    mocks.remote = null;
    expect(await hydrateRecipesFromSupabase({ force: true })).toBe(false);
    expect(RecipeLibrary.getById('ai-1-curry')).toBeDefined();
  });

  it('keeps the cache when the server has no recipes', async () => {
    mocks.remote = [recipe('ai-1-curry', 'ai-generated')];
    await hydrateRecipesFromSupabase();
    mocks.remote = [];
    expect(await hydrateRecipesFromSupabase({ force: true })).toBe(true);
    expect(RecipeLibrary.getById('ai-1-curry')).toBeDefined();
  });

  it('does nothing signed out', async () => {
    mocks.user = null;
    expect(await hydrateRecipesFromSupabase()).toBe(false);
    expect(mocks.loads).toBe(0);
  });

  it('shares one read between pages that ask at the same time', async () => {
    mocks.remote = [recipe('ai-1-curry', 'ai-generated')];
    await Promise.all([hydrateRecipesFromSupabase(), hydrateRecipesFromSupabase(), hydrateRecipesFromSupabase()]);
    expect(mocks.loads).toBe(1);
  });

  it('counts a load in the last two minutes as fresh, unless forced', async () => {
    mocks.remote = [recipe('ai-1-curry', 'ai-generated')];
    await hydrateRecipesFromSupabase();
    await hydrateRecipesFromSupabase();
    expect(mocks.loads).toBe(1);
    await hydrateRecipesFromSupabase({ force: true });
    expect(mocks.loads).toBe(2);
  });

  it('loads again after the cache is cleared (sign-out, or another household), even within two minutes', async () => {
    mocks.remote = [recipe('ai-1-curry', 'ai-generated')];
    await hydrateRecipesFromSupabase();
    await new Promise((resolve) => setTimeout(resolve, 2));
    RecipeLibrary.clearAllRecipeData();
    expect(await hydrateRecipesFromSupabase()).toBe(true);
    expect(mocks.loads).toBe(2);
    expect(RecipeLibrary.getById('ai-1-curry')).toBeDefined();
  });

  it("doesn't bring back a recipe deleted while the list was being read", async () => {
    mocks.remote = [recipe('custom-1-soup', 'user-added'), recipe('ai-1-curry', 'ai-generated')];
    await hydrateRecipesFromSupabase();
    await RecipeLibrary.removeCustomRecipe('custom-1-soup');
    await RecipeLibrary.removeCustomRecipe('ai-1-curry');
    // The server's answer from before the deletes arrives afterwards
    expect(await hydrateRecipesFromSupabase({ force: true })).toBe(true);
    expect(RecipeLibrary.getById('custom-1-soup')).toBeUndefined();
    expect(RecipeLibrary.getById('ai-1-curry')).toBeUndefined();
  });
});
