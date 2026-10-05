import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildRecipeGenerationPrompt, type RecipeGenerationRequest } from '../recipeGeneration';
import { DEFAULT_FAMILY_SETTINGS } from '../../types/settings';

const familySettings = {
  ...DEFAULT_FAMILY_SETTINGS,
  // Distinct values so the assertions can't pass by accident.
  maxCookTime: { weeknight: 25, weekend: 70 },
};

function prompt(specificDays?: RecipeGenerationRequest['specificDays']): string {
  return buildRecipeGenerationPrompt({ familySettings, numberOfRecipes: 3, specificDays });
}

describe('buildRecipeGenerationPrompt day type', () => {
  beforeEach(() => {
    // The prompt includes the current month's season; pin it so results don't vary.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-03T10:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses weekend rules for a Saturday', () => {
    const text = prompt([{ index: 5, type: 'weekend' }]);
    expect(text.split('\n')[0]).toBe('Generate 3 weekend dinner recipes with these requirements:');
    expect(text).toContain('Maximum cooking time: 70 minutes');
    expect(text).not.toContain('Maximum cooking time: 25 minutes');
  });

  it('uses weeknight rules for a Tuesday', () => {
    const text = prompt([{ index: 1, type: 'weeknight' }]);
    expect(text.split('\n')[0]).toBe('Generate 3 weeknight dinner recipes with these requirements:');
    expect(text).toContain('Maximum cooking time: 25 minutes');
  });

  it.each([
    ['no specificDays', undefined],
    ['an empty specificDays', []],
  ])('uses weeknight rules for %s', (_label, specificDays) => {
    const text = prompt(specificDays);
    expect(text.split('\n')[0]).toBe('Generate 3 weeknight dinner recipes with these requirements:');
    expect(text).toContain('Maximum cooking time: 25 minutes');
    expect(text).not.toContain('mixed');
  });
});
