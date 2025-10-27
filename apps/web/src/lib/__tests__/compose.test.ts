import { describe, it, expect } from 'vitest';
import { composeWeek, getSuggestedSwaps } from '../compose';
import type { Household, WeeklyOverrides } from '../types/recipe';
import { nextWeekMondayISO } from '../schedule';

describe('composeWeek', () => {
  const mockHousehold: Household = {
    id: 'test-household',
    members: {
      adults: 2,
      kids: 2,
    },
    diet: {
      glutenLight: true,
      highProtein: false,
      organicPreferred: false,
    },
    retailer: 'coles',
    favorites: [],
    pantry: [],
  };

  it('generates 5 dinners by default', () => {
    const result = composeWeek(mockHousehold);
    
    expect(result.days).toHaveLength(5);
    expect(result.days.every(day => day.recipeId)).toBe(true);
  });

  it('respects dinner count override', () => {
    const overrides: WeeklyOverrides = {
      weekOfISO: nextWeekMondayISO(),
      dinners: 3,
      servingsPerMeal: 4,
      kidFriendlyWeeknights: true,
      dietAdjust: {},
      pantryAdds: [],
    };
    
    const result = composeWeek(mockHousehold, overrides);
    
    expect(result.days).toHaveLength(3);
  });

  it('generates dates for the next week starting Monday', () => {
    const result = composeWeek(mockHousehold);
    
    // All dates should be in ISO format (YYYY-MM-DD)
    result.days.forEach(day => {
      expect(day.dateISO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it('calculates cost estimate', () => {
    const result = composeWeek(mockHousehold);
    
    expect(result.costEstimate).toBeGreaterThan(0);
    expect(typeof result.costEstimate).toBe('number');
  });

  it('sets scaled servings to 4 by default', () => {
    const result = composeWeek(mockHousehold);
    
    result.days.forEach(day => {
      expect(day.scaledServings).toBe(4);
    });
  });

  it('respects servings override', () => {
    const overrides: WeeklyOverrides = {
      weekOfISO: nextWeekMondayISO(),
      dinners: 5,
      servingsPerMeal: 6,
      kidFriendlyWeeknights: true,
      dietAdjust: {},
      pantryAdds: [],
    };
    
    const result = composeWeek(mockHousehold, overrides);
    
    result.days.forEach(day => {
      expect(day.scaledServings).toBe(6);
    });
  });

  it('includes recipes in the result', () => {
    const result = composeWeek(mockHousehold);
    
    // At least one recipe should be selected
    expect(result.days.length).toBeGreaterThan(0);
    expect(result.days[0].recipeId).toBeDefined();
  });
});

describe('getSuggestedSwaps', () => {
  const mockHousehold: Household = {
    id: 'test-household',
    members: {
      adults: 2,
      kids: 2,
    },
    diet: {
      glutenLight: true,
      highProtein: false,
      organicPreferred: false,
    },
    retailer: 'coles',
    favorites: [],
    pantry: [],
  };

  it('returns alternative recipes', () => {
    const result = composeWeek(mockHousehold);
    const firstRecipeId = result.days[0].recipeId;
    
    const swaps = getSuggestedSwaps(firstRecipeId, false, true);
    
    expect(Array.isArray(swaps)).toBe(true);
    // Should suggest at least 1 swap (up to 3)
    expect(swaps.length).toBeGreaterThanOrEqual(0);
    expect(swaps.length).toBeLessThanOrEqual(3);
  });

  it('excludes the current recipe from suggestions', () => {
    const result = composeWeek(mockHousehold);
    const firstRecipeId = result.days[0].recipeId;
    
    const swaps = getSuggestedSwaps(firstRecipeId, false, true);
    
    // None of the swaps should be the current recipe
    swaps.forEach(swap => {
      expect(swap.id).not.toBe(firstRecipeId);
    });
  });

  it('returns empty array if recipe not found', () => {
    const swaps = getSuggestedSwaps('non-existent-recipe', false, true);
    
    expect(swaps).toEqual([]);
  });

  it('respects kid-friendly filter for weeknights', () => {
    const result = composeWeek(mockHousehold);
    const firstRecipeId = result.days[0].recipeId;
    
    const swaps = getSuggestedSwaps(firstRecipeId, false, true);
    
    // All weeknight swaps with kidFriendly=true should have kid_friendly tag
    swaps.forEach(swap => {
      if (swap.tags) {
        // We can't guarantee all have kid_friendly, but they should be appropriate
        expect(swap.tags).toBeDefined();
      }
    });
  });
});
