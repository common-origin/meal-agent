import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { Recipe } from '@/lib/types/recipe';

const recipe = (id: string, title: string, domain: string, chef?: string): Recipe =>
  ({ id, title, ingredients: [], tags: [], timeMins: 30, source: { domain, chef }, createdAt: '2026-11-01' }) as unknown as Recipe;
const OWN = recipe('ai-soup-1', 'Pumpkin soup', 'ai-generated');
const LIBRARY = recipe('lib-stew-1', 'Beef stew', 'taste.com.au', 'Jamie Oliver');

const mocks = vi.hoisted(() => ({
  removeCustomRecipe: vi.fn(async () => true),
  clearCustomRecipes: vi.fn(() => true),
  cleared: false,
}));
vi.mock('@/lib/library', () => ({
  RecipeLibrary: {
    // After "Clear all", only the favourited library recipe is left
    getCustomRecipes: () => (mocks.cleared ? [LIBRARY] : [OWN, LIBRARY]),
    removeCustomRecipe: mocks.removeCustomRecipe,
    clearCustomRecipes: () => {
      mocks.cleared = true;
      return mocks.clearCustomRecipes();
    },
    getConfirmedRecipeIds: () => [],
  },
}));
vi.mock('@/lib/storage', () => ({
  getFavorites: () => ['lib-stew-1'],
  isFavorite: () => false,
  toggleFavorite: vi.fn(),
  Storage: { set: vi.fn() },
}));
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import RecipesPage from '../page';

const openMenu = (title: string) => fireEvent.click(screen.getByRole('button', { name: `More options for ${title}` }));

describe('/recipes delete (#179)', () => {
  beforeEach(() => {
    mocks.removeCustomRecipe.mockClear();
    mocks.cleared = false;
    // Stand-ins, so a stray confirm()/alert() call is caught (the test DOM has neither)
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.stubGlobal('alert', vi.fn());
  });

  it('labels the action by what it does, confirms in a dialog and reports on the page', async () => {
    render(<RecipesPage />);
    openMenu('Pumpkin soup');
    expect(screen.queryByText('Remove from plan')).toBeNull();
    fireEvent.click(screen.getByText('Delete recipe'));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Delete this recipe?')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete recipe' }));

    expect(await screen.findByText('Deleted "Pumpkin soup".')).toBeInTheDocument();
    expect(mocks.removeCustomRecipe).toHaveBeenCalledWith('ai-soup-1');
    expect(globalThis.confirm).not.toHaveBeenCalled();
    expect(globalThis.alert).not.toHaveBeenCalled();
  });

  it('says "Remove from My recipes" for a favourited library recipe, which it does not delete', async () => {
    render(<RecipesPage />);
    openMenu('Beef stew');
    fireEvent.click(screen.getByText('Remove from My recipes'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Remove from My recipes?')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove from My recipes' }));
    expect(await screen.findByText('Removed "Beef stew" from My recipes.')).toBeInTheDocument();
    expect(mocks.removeCustomRecipe).not.toHaveBeenCalled();
  });

  it('cancelling the dialog keeps the recipe', async () => {
    render(<RecipesPage />);
    openMenu('Pumpkin soup');
    fireEvent.click(screen.getByText('Delete recipe'));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(mocks.removeCustomRecipe).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Pumpkin soup' })).toBeInTheDocument();
  });

  it('"Clear all" confirms in a dialog, deletes only what you added, and says so', async () => {
    render(<RecipesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Favourites and saved AI recipes stay/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete all' }));
    expect(mocks.clearCustomRecipes).toHaveBeenCalled();
    expect(await screen.findByText('Deleted the recipes you added.')).toBeInTheDocument();
    // The favourited library recipe survives and stays on screen
    expect(screen.getByRole('link', { name: 'Beef stew' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Pumpkin soup' })).toBeNull();
    expect(globalThis.confirm).not.toHaveBeenCalled();
  });

  it('keeps the dialog wording while it closes', async () => {
    render(<RecipesPage />);
    openMenu('Pumpkin soup');
    fireEvent.click(screen.getByText('Delete recipe'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    // Still rendered while it animates out: same title, not the library wording
    expect(dialog.isConnected).toBe(true);
    expect(within(dialog).queryByText('Remove from My recipes?')).toBeNull();
    expect(within(dialog).getByText('Delete this recipe?')).toBeInTheDocument();
  });

  it('deletes once even if the confirm button is pressed twice', async () => {
    render(<RecipesPage />);
    openMenu('Pumpkin soup');
    fireEvent.click(screen.getByText('Delete recipe'));
    const confirmButton = within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete recipe' });
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);
    await screen.findByText('Deleted "Pumpkin soup".');
    expect(mocks.removeCustomRecipe).toHaveBeenCalledTimes(1);
  });
});

describe('/recipes loading (#181)', () => {
  it('first renders skeleton cards under a named status', async () => {
    const { renderToString } = await import('react-dom/server');
    const html = renderToString(<RecipesPage />);
    expect(html).toContain('role="status"');
    expect(html).toContain('Loading your recipes');
    expect(html).toContain('data-testid="meal-card-skeleton"');
    expect(html).not.toContain('Loading recipes...');
  });
});
