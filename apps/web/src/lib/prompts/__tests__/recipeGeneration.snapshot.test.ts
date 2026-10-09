import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildRecipeGenerationPrompt,
  buildSystemPrompt,
  monthInTimeZone,
  resolveTimeZone,
  type RecipeGenerationRequest,
} from '../recipeGeneration';
import { DEFAULT_FAMILY_SETTINGS } from '../../types/settings';
import { VALID_TAGS } from '../../tagNormalizer';

// Reference settings from #87: 2 adults, 2 kids, 3 cuisines, 6 pantry items.
const reference: RecipeGenerationRequest = {
  familySettings: { ...DEFAULT_FAMILY_SETTINGS, cuisines: ['mexican', 'italian', 'indian'], lastUpdated: '2026-10-01T00:00:00.000Z' },
  numberOfRecipes: 5,
  pantryItems: ['chicken thighs', 'broccoli', 'carrots', 'greek yoghurt', 'spinach', 'cheddar cheese'],
  timeZone: 'Australia/Melbourne',
};

const fullPrompt = (request: RecipeGenerationRequest) => `${buildSystemPrompt()}\n\n${buildRecipeGenerationPrompt(request)}`;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-15T00:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('generation prompt (#87)', () => {
  it('matches the snapshot for the reference settings', () => {
    expect(buildSystemPrompt()).toMatchSnapshot('system');
    expect(buildRecipeGenerationPrompt(reference)).toMatchSnapshot('user');
  });

  it('fits the ≤ 3,300-token target (≤ 13,200 chars at ~4 chars per token)', () => {
    expect(fullPrompt(reference).length).toBeLessThanOrEqual(13_200);
  });

  it.each(['cilantro', '0 children', 'estimatedCost', 'Ottolenghi', 'Nigella', 'Jamie Oliver'])('does not contain "%s"', (text) => {
    expect(fullPrompt(reference)).not.toContain(text);
  });

  it('has no empty "Examples of" line', () => {
    expect(fullPrompt(reference)).not.toMatch(/Examples of[^\n]*:\s*\n/);
  });

  it('lists in-season produce for the household month', () => {
    // October in the southern hemisphere is spring.
    const prompt = buildRecipeGenerationPrompt(reference);
    expect(prompt).toContain('It is October (spring) in Melbourne, Australia.');
    expect(prompt).toMatch(/In season now: [^.]*asparagus/);
  });

  it('states each resolved rule once', () => {
    const prompt = fullPrompt(reference);
    expect(prompt.match(/5–7 steps/g)).toHaveLength(1);
    expect(prompt.match(/8–12 ingredients/g)).toHaveLength(1);
    expect(prompt).not.toMatch(/5-8|4–7|8-14/);
  });

  it('lists every valid tag as allowed', () => {
    expect(buildSystemPrompt()).toContain(VALID_TAGS.join(', '));
  });

  it('includes the kids section for a household with children', () => {
    expect(buildRecipeGenerationPrompt(reference)).toMatch(/\nKIDS\n- Kid-friendly for ages 5, 7/);
  });

  it('has no kids line or section for a household without children', () => {
    const prompt = buildRecipeGenerationPrompt({
      ...reference,
      familySettings: { ...reference.familySettings, adults: 2, children: [], totalServings: 2 },
    });
    expect(prompt).toContain('Servings: 2 (2 adults).');
    expect(prompt).not.toMatch(/KIDS|children|kid-friendly/i);
  });

  it('keeps the user-set preferred chef', () => {
    const prompt = buildRecipeGenerationPrompt({
      ...reference,
      familySettings: { ...reference.familySettings, preferredChef: 'RecipeTin Eats' },
    });
    expect(prompt).toContain('home-cook style of RecipeTin Eats');
  });
});

describe('time zone', () => {
  it('uses the household zone for the month, not the server clock', () => {
    // 15:00 UTC on 30 September is already 1 October in Melbourne.
    const now = new Date('2026-09-30T15:00:00Z');
    expect(monthInTimeZone('Australia/Melbourne', now)).toEqual({ index: 9, name: 'October' });
    expect(monthInTimeZone('Europe/London', now)).toEqual({ index: 8, name: 'September' });
  });

  it('falls back to Australia/Melbourne for a missing or unknown zone', () => {
    expect(resolveTimeZone(undefined)).toBe('Australia/Melbourne');
    expect(resolveTimeZone('Not/AZone')).toBe('Australia/Melbourne');
    expect(resolveTimeZone('Europe/London')).toBe('Europe/London');
  });

  it('computes the prompt month in the request time zone', () => {
    vi.setSystemTime(new Date('2026-09-30T15:00:00Z'));
    expect(buildRecipeGenerationPrompt({ ...reference, timeZone: 'Australia/Melbourne' })).toContain('It is October');
    expect(buildRecipeGenerationPrompt({ ...reference, timeZone: 'Not/AZone' })).toContain('It is October');
  });
});
