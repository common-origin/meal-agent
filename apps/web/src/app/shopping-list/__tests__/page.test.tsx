import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

// An empty week, so the list builds without Supabase, Coles or the recipe library
vi.mock('@/lib/hybridStorage', () => ({
  loadCurrentWeekPlan: vi.fn(async () => null),
  savePantryItems: vi.fn(async () => undefined),
  loadPantryItems: vi.fn(async () => []),
  hydrateRecencyFromSupabase: vi.fn(async () => undefined),
  syncRecencyToSupabase: vi.fn(async () => undefined),
}));
vi.mock('@/lib/compose', () => ({ composeWeek: () => ({ startISO: '2026-10-26', days: [], costEstimate: 0, conflicts: [] }) }));
vi.mock('@/lib/shoppingListAggregator', () => ({ aggregateShoppingList: () => [], toLegacyFormat: () => [] }));
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));
vi.mock('@/lib/schedule', () => ({ nextWeekMondayISO: () => '2026-10-26' }));
vi.mock('@/components/app/ApiQuotaWarning', () => ({ default: () => null }));

import ShoppingListPage from '../page';
import { isShoppingComplete, markShoppingComplete } from '@/lib/shoppingCompletion';

describe('/shopping-list completed screen (#173)', () => {
  beforeEach(() => localStorage.clear());

  it('shows the list for a week not marked complete', async () => {
    render(<ShoppingListPage />);
    expect(await screen.findByRole('heading', { name: 'Shopping list' })).toBeInTheDocument();
    expect(screen.queryByText('Shopping completed')).toBeNull();
  });

  it('"Show the shopping list" reopens a completed week\'s list', async () => {
    markShoppingComplete('2026-10-26');
    render(<ShoppingListPage />);
    expect(await screen.findByText('Shopping completed')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show the shopping list' }));

    expect(isShoppingComplete('2026-10-26')).toBe(false);
    expect(await screen.findByRole('heading', { name: 'Shopping list' })).toBeInTheDocument();
    expect(screen.queryByText('Shopping completed')).toBeNull();
  });
});

describe('/shopping-list "Shop at Coles" (#184)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window, 'open').mockReturnValue(null);
  });

  it('saves the list for the extension and opens Coles', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true, count: 0 })));
    render(<ShoppingListPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Shop at Coles' }));

    expect(await screen.findByText('List sent to Coles')).toBeInTheDocument();
    expect(window.open).toHaveBeenCalledWith('https://www.coles.com.au', '_blank');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/coles/list');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual({ weekStart: '2026-10-26', items: [] });
  });

  it('says why when the list can’t be sent', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: 'Sign in with a household to shop at Coles.' }), { status: 401 }));
    render(<ShoppingListPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Shop at Coles' }));

    expect(await screen.findByText('Sign in with a household to shop at Coles.')).toBeInTheDocument();
  });

  it('marks shopping done from the list', async () => {
    render(<ShoppingListPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mark shopping done' }));
    expect(await screen.findByText('Shopping completed')).toBeInTheDocument();
  });
});
