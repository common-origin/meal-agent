import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MealPlan } from '../supabaseStorage';

// Signed in or not, per test; Supabase is an in-memory meal_plans row.
const mocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
  row: null as MealPlan | null,
}));

vi.mock('../supabase/client', () => ({ getCurrentUser: async () => mocks.user }));
vi.mock('../supabaseStorage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../supabaseStorage')>()),
  saveMealPlan: vi.fn(async (plan: MealPlan) => {
    mocks.row = JSON.parse(JSON.stringify(plan)); // JSONB round trip
    return true;
  }),
  loadMealPlan: vi.fn(async () => mocks.row),
  loadPantryItems: vi.fn(async () => []),
}));

import { loadCurrentWeekPlan, saveCurrentWeekPlan } from '../hybridStorage';

const WEEK = '2026-10-12';
const ids = ['r-mon', 'r-tue', '', 'r-thu'];
const reasons = ['Uses your broccoli before it wilts.', '', '', 'Mild enough for the kids.'];

describe.each([
  ['signed in (Supabase meal_plans.meals JSONB)', { id: 'user-1' }],
  ['signed out (localStorage)', null],
])('week plan "why this meal" reasons (#94), %s', (_label, user) => {
  beforeEach(() => {
    localStorage.clear();
    mocks.user = user;
    mocks.row = null;
  });

  it('round-trip, aligned with the days', async () => {
    expect(await saveCurrentWeekPlan(ids, WEEK, undefined, reasons)).toBe(true);
    const plan = await loadCurrentWeekPlan(WEEK);
    expect(plan?.recipeIds).toEqual(['r-mon', 'r-tue', '', 'r-thu', '', '', '']);
    expect(plan?.reasons).toEqual(['Uses your broccoli before it wilts.', '', '', 'Mild enough for the kids.', '', '', '']);
  });

  it('load as empty strings for a plan saved without reasons', async () => {
    await saveCurrentWeekPlan(ids, WEEK);
    const plan = await loadCurrentWeekPlan(WEEK);
    expect(plan?.recipeIds.slice(0, 4)).toEqual(ids);
    expect(plan?.reasons).toEqual(['', '', '', '', '', '', '']);
  });
});

describe('older stored plans (#94)', () => {
  it('load a Supabase plan whose meals have no reason key', async () => {
    mocks.user = { id: 'user-1' };
    mocks.row = { weekStart: WEEK, meals: { monday: { recipeId: 'r-mon' }, tuesday: null } };
    const plan = await loadCurrentWeekPlan(WEEK);
    expect(plan?.recipeIds[0]).toBe('r-mon');
    expect(plan?.reasons?.[0]).toBe('');
  });

  it('load a localStorage plan saved before reasons existed', async () => {
    mocks.user = null;
    localStorage.clear();
    localStorage.setItem(
      'meal-agent:current-week-plan:v1',
      JSON.stringify({ recipeIds: ['r-mon'], weekOfISO: WEEK, createdAt: '2026-10-01T00:00:00Z' })
    );
    const plan = await loadCurrentWeekPlan(WEEK);
    expect(plan?.recipeIds[0]).toBe('r-mon');
    expect(plan?.reasons).toEqual(['', '', '', '', '', '', '']);
  });
});
