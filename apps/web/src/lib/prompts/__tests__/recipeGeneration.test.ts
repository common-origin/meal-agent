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

describe('buildRecipeGenerationPrompt taste and history (#88)', () => {
  const lines = {
    recent: "Don't repeat or closely resemble these recent meals:",
    disliked: 'The household disliked these. Avoid similar dishes:',
    loved: 'The household loves these.',
  };

  it('renders each list on its own line when non-empty', () => {
    const text = buildRecipeGenerationPrompt({
      familySettings,
      numberOfRecipes: 3,
      recentMealTitles: ['Beef Tacos', 'Pumpkin Risotto'],
      dislikedMealTitles: ['Liver and Onions'],
      lovedMealTitles: ['Chicken Katsu Curry (japanese)'],
    });
    expect(text).toContain(`${lines.recent} Beef Tacos; Pumpkin Risotto.`);
    expect(text).toContain(`${lines.disliked} Liver and Onions.`);
    expect(text).toContain(lines.loved);
    expect(text).toContain("Don't copy them: Chicken Katsu Curry (japanese).");
  });

  it('omits every line (and the TASTE heading) when the lists are empty or missing', () => {
    for (const request of [
      { familySettings, numberOfRecipes: 3 },
      { familySettings, numberOfRecipes: 3, recentMealTitles: [], dislikedMealTitles: [], lovedMealTitles: [] },
    ]) {
      const text = buildRecipeGenerationPrompt(request);
      for (const line of Object.values(lines)) expect(text).not.toContain(line);
      expect(text).not.toContain('TASTE');
    }
  });

  it('contains no recipe IDs', () => {
    const text = buildRecipeGenerationPrompt({
      familySettings: { ...familySettings, dislikedRecipeIds: ['ai-123e4567-e89b-12d3-a456-426614174000'] } as typeof familySettings,
      numberOfRecipes: 3,
      recentMealTitles: ['Beef Tacos'],
    });
    expect(text).not.toMatch(/\b(ai|custom)-[0-9a-z-]+/i);
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
  });
});

describe('buildRecipeGenerationPrompt use-soon pantry items (#91)', () => {
  const line = 'Use these first; they need using this week:';

  it('lists use-soon items in the PANTRY section', () => {
    const text = buildRecipeGenerationPrompt({
      familySettings,
      numberOfRecipes: 3,
      pantryItems: ['spinach', 'eggs'],
      useSoonItems: ['spinach', 'beef mince'],
    });
    const pantry = text.slice(text.indexOf('PANTRY'));
    expect(pantry).toContain(`${line} spinach, beef mince.`);
  });

  it('omits the line when nothing needs using soon', () => {
    expect(buildRecipeGenerationPrompt({ familySettings, numberOfRecipes: 3, pantryItems: ['eggs'] })).not.toContain(line);
    expect(buildRecipeGenerationPrompt({ familySettings, numberOfRecipes: 3, useSoonItems: [] })).not.toContain(line);
  });
});
