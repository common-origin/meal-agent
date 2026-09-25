import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearHouseholdScopedCaches,
  saveHousehold,
  loadHousehold,
  getDefaultHousehold,
  saveFamilySettings,
  loadFamilySettings,
  saveCurrentWeekPlan,
  loadCurrentWeekPlan,
  saveRecipeRating,
  getRecipeRatings,
  blockRecipe,
  getBlockedRecipes,
  saveWeeklyOverrides,
  loadWeeklyOverrides,
} from '../storage';
import { savePantryPreferences, loadPantryPreferences } from '../pantryPreferences';
import { recordWeekRecipes, getRecipeHistory } from '../recencyTracker';
import { RecipeLibrary } from '../library';
import { seedRecipeLibrary } from './fixtures/seedRecipeLibrary';
import { DEFAULT_FAMILY_SETTINGS } from '../types/settings';

describe('clearHouseholdScopedCaches', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('clears the saved household', () => {
    saveHousehold({ ...getDefaultHousehold(), id: 'household-1' });

    clearHouseholdScopedCaches();

    expect(loadHousehold()).toBeNull();
  });

  it('clears family settings', () => {
    saveFamilySettings({ ...DEFAULT_FAMILY_SETTINGS });

    clearHouseholdScopedCaches();

    expect(loadFamilySettings()).toBeNull();
  });

  it('clears the current week plan', () => {
    saveCurrentWeekPlan(['recipe-1'], '2026-01-05');

    clearHouseholdScopedCaches();

    expect(loadCurrentWeekPlan('2026-01-05')).toBeNull();
  });

  it('clears recipe ratings and blocked recipes', () => {
    saveRecipeRating('recipe-1', 5);
    blockRecipe('recipe-2');

    clearHouseholdScopedCaches();

    expect(getRecipeRatings()).toEqual({});
    expect(getBlockedRecipes().size).toBe(0);
  });

  it('clears every weekly-overrides key, not just one week', () => {
    saveWeeklyOverrides({
      weekOfISO: '2026-01-05',
      dinners: 5,
      servingsPerMeal: 4,
      kidFriendlyWeeknights: true,
      dietAdjust: {},
      pantryAdds: [],
    });
    saveWeeklyOverrides({
      weekOfISO: '2026-01-12',
      dinners: 3,
      servingsPerMeal: 6,
      kidFriendlyWeeknights: false,
      dietAdjust: {},
      pantryAdds: [],
    });

    clearHouseholdScopedCaches();

    expect(loadWeeklyOverrides('2026-01-05')).toBeNull();
    expect(loadWeeklyOverrides('2026-01-12')).toBeNull();
  });

  it('clears pantry preferences', () => {
    savePantryPreferences(new Set(['chicken breast']));

    clearHouseholdScopedCaches();

    expect(loadPantryPreferences().size).toBe(0);
  });

  it('clears recipe recency history', () => {
    recordWeekRecipes('2026-01-05', ['recipe-1', 'recipe-2']);

    clearHouseholdScopedCaches();

    expect(getRecipeHistory()).toEqual([]);
  });

  it('clears cached recipes, including the in-memory cache (not just localStorage)', () => {
    seedRecipeLibrary();
    // Populate RecipeLibrary's in-memory cache before clearing, since a
    // client-side navigation (no full reload) would otherwise keep serving
    // this in-memory data even after localStorage is wiped underneath it.
    expect(RecipeLibrary.getAll().length).toBeGreaterThan(0);

    clearHouseholdScopedCaches();

    expect(RecipeLibrary.getAll()).toEqual([]);
  });

  it('does not touch unrelated localStorage keys (e.g. maintainer-only tooling data)', () => {
    localStorage.setItem('meal-agent:ingredient-frequency:v1', JSON.stringify({ chicken: 5 }));

    clearHouseholdScopedCaches();

    expect(localStorage.getItem('meal-agent:ingredient-frequency:v1')).not.toBeNull();
  });
});
