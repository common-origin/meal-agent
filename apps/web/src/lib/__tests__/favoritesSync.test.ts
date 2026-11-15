import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' } as { id: string } | null,
  remote: { householdId: 'h1', recipeIds: [] as string[] } as { householdId: string; recipeIds: string[] } | null,
  addOk: true,
  added: [] as string[][],
  removed: [] as string[],
}));

vi.mock('../supabase/client', () => ({ getCurrentUser: async () => mocks.user }));
vi.mock('../supabaseStorage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../supabaseStorage')>()),
  loadFavoritesFromDb: vi.fn(async () => mocks.remote && { ...mocks.remote, recipeIds: [...mocks.remote.recipeIds] }),
  addFavoritesToDb: vi.fn(async (ids: string[]) => {
    mocks.added.push(ids);
    return mocks.addOk;
  }),
  removeFavoriteFromDb: vi.fn(async (id: string) => {
    mocks.removed.push(id);
    return true;
  }),
}));

import { hydrateFavoritesFromSupabase, toggleFavorite } from '../hybridStorage';
import { getFavorites, setFavorites } from '../storage';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  localStorage.clear();
  mocks.user = { id: 'user-1' };
  mocks.remote = { householdId: 'h1', recipeIds: [] };
  mocks.addOk = true;
  mocks.added = [];
  mocks.removed = [];
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('favourites sync (#222)', () => {
  it('uploads local favourites the first time a device syncs a household, and keeps both', async () => {
    setFavorites(['local-a', 'shared']);
    mocks.remote = { householdId: 'h1', recipeIds: ['shared', 'remote-b'] };
    expect(await hydrateFavoritesFromSupabase()).toEqual(['shared', 'remote-b', 'local-a']);
    expect(mocks.added).toEqual([['local-a']]);
    expect(getFavorites()).toEqual(['shared', 'remote-b', 'local-a']);
  });

  it('after the first sync, the server wins, so removals elsewhere carry over', async () => {
    mocks.remote = { householdId: 'h1', recipeIds: ['a', 'b'] };
    await hydrateFavoritesFromSupabase();
    mocks.remote = { householdId: 'h1', recipeIds: ['b'] }; // 'a' removed on another device
    expect(await hydrateFavoritesFromSupabase()).toEqual(['b']);
    expect(getFavorites()).toEqual(['b']);
    expect(mocks.added).toEqual([]);
  });

  it('keeps local favourites, and tries again, when the first upload fails', async () => {
    setFavorites(['local-a']);
    mocks.addOk = false;
    expect(await hydrateFavoritesFromSupabase()).toEqual(['local-a']);
    mocks.addOk = true;
    expect(await hydrateFavoritesFromSupabase()).toEqual(['local-a']);
    expect(mocks.added).toEqual([['local-a'], ['local-a']]);
  });

  it('leaves the local list alone when signed out or Supabase can\'t be read', async () => {
    setFavorites(['local-a']);
    mocks.user = null;
    expect(await hydrateFavoritesFromSupabase()).toEqual(['local-a']);
    mocks.user = { id: 'user-1' };
    mocks.remote = null;
    expect(await hydrateFavoritesFromSupabase()).toEqual(['local-a']);
    expect(mocks.added).toEqual([]);
  });

  it('toggles locally at once and in Supabase in the background', async () => {
    expect(toggleFavorite('r1')).toBe(true);
    expect(getFavorites()).toEqual(['r1']);
    await flush();
    expect(mocks.added).toEqual([['r1']]);

    expect(toggleFavorite('r1')).toBe(false);
    expect(getFavorites()).toEqual([]);
    await flush();
    expect(mocks.removed).toEqual(['r1']);
  });

  it('toggles only locally when signed out', async () => {
    mocks.user = null;
    toggleFavorite('r1');
    await flush();
    expect(getFavorites()).toEqual(['r1']);
    expect(mocks.added).toEqual([]);
  });
});
