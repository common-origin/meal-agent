import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { render, screen } from '@testing-library/react';
import type { Recipe } from '@/lib/types/recipe';

const fixtures = vi.hoisted(() => ({ SOUP: null as unknown as Recipe, hydrated: false, hydrations: 0 }));
const SOUP = { id: 'soup-1', title: 'Pumpkin soup', ingredients: [], instructions: [], tags: [], timeMins: 30, serves: 4, source: { domain: 'ai-generated' } } as unknown as Recipe;

// Every localStorage-backed read the page makes, so a read during render is caught (#200).
const mocks = vi.hoisted(() => {
  const reads: string[] = [];
  const read = <T,>(name: string, value: T) => () => {
    reads.push(name);
    return value;
  };
  return { reads, read };
});
// 'soup-1' is in this browser; 'shared-1' only arrives once the household's recipes are loaded (#233).
vi.mock('@/lib/library', () => ({
  RecipeLibrary: {
    getById: (id: string) =>
      mocks.read('getById', id === 'soup-1' || (id === 'shared-1' && fixtures.hydrated) ? { ...fixtures.SOUP, id, title: id === 'shared-1' ? 'Shared stew' : fixtures.SOUP.title } : undefined)(),
  },
}));
vi.mock('@/lib/storage', () => ({
  isFavorite: mocks.read('isFavorite', false),
  getRecipeRating: mocks.read('getRecipeRating', 0),
  isRecipeBlocked: mocks.read('isRecipeBlocked', false),
  saveRecipeRating: vi.fn(),
  blockRecipe: vi.fn(),
}));
vi.mock('@/lib/hybridStorage', () => ({
  hydrateFavoritesFromSupabase: async () => [],
  hydrateRecipesFromSupabase: async () => {
    fixtures.hydrations++;
    fixtures.hydrated = true;
    return true;
  },
  toggleFavorite: vi.fn(),
  getFamilySettings: async () => ({ recipeRecipients: [] }),
}));
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn() }) }));

import RecipePage from '../page';

/** Route params already resolved, as React's use() reads a fulfilled thenable synchronously. */
function params(id: string) {
  return Object.assign(Promise.resolve({ id }), { status: 'fulfilled', value: { id } }) as unknown as Promise<{ id: string }>;
}

fixtures.SOUP = SOUP;

beforeEach(() => {
  mocks.reads.length = 0;
  fixtures.hydrated = false;
  fixtures.hydrations = 0;
});

describe('/recipe/[id] hydration (#200)', () => {
  it("renders the same loading state on the server, without reading the browser's storage", () => {
    const html = renderToString(<RecipePage params={params('soup-1')} />);
    expect(html).toContain('Loading recipe');
    expect(mocks.reads).toEqual([]);
  });

  it('shows the recipe once mounted', async () => {
    render(<RecipePage params={params('soup-1')} />);
    expect(await screen.findByRole('heading', { name: 'Pumpkin soup' })).toBeInTheDocument();
  });

  it('shows "Recipe not found" only after loading finds nothing', async () => {
    render(<RecipePage params={params('missing')} />);
    expect(await screen.findByText('Recipe not found')).toBeInTheDocument();
  });

  it("opens a household recipe this browser hasn't seen, after loading the household's recipes (#233)", async () => {
    render(<RecipePage params={params('shared-1')} />);
    expect(await screen.findByRole('heading', { name: 'Shared stew' })).toBeInTheDocument();
    expect(fixtures.hydrations).toBe(1);
  });

  it("doesn't reload the household's recipes for a recipe already here", async () => {
    render(<RecipePage params={params('soup-1')} />);
    await screen.findByRole('heading', { name: 'Pumpkin soup' });
    expect(fixtures.hydrations).toBe(0);
  });
});
