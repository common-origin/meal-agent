import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DEFAULT_FAMILY_SETTINGS, validateFamilySettings } from '../types/settings';
import { buildRecipeGenerationPrompt } from '../prompts/recipeGeneration';

// A household's family_settings row as the new-user trigger creates it: column defaults, full_settings NULL.
const NEW_HOUSEHOLD_ROW = {
  household_id: 'h-1',
  total_servings: 4,
  adults: 2,
  kids: 0,
  kids_ages: [] as number[],
  cuisines: [] as string[],
  dietary_restrictions: [] as string[],
  cooking_time_preference: 'medium',
  skill_level: 'intermediate',
  full_settings: null as unknown,
  updated_at: '2026-11-14T00:00:00.000Z',
};

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' } as { id: string } | null,
  settingsRow: null as Record<string, unknown> | null,
  settingsError: null as { message: string } | null,
}));

vi.mock('@/lib/supabase/client', () => ({
  getCurrentUser: async () => mocks.user,
  createClient: () => ({
    from: (table: string) => {
      const result = () =>
        table === 'household_members'
          ? { data: { household_id: 'h-1' }, error: null }
          : { data: mocks.settingsError ? null : mocks.settingsRow, error: mocks.settingsError };
      const chain = {
        select: () => chain,
        eq: () => chain,
        single: async () => result(),
        maybeSingle: async () => result(),
      };
      return chain;
    },
  }),
}));

import { householdNeedsSetup, loadFamilySettingsFromDb } from '../supabaseStorage';

beforeEach(() => {
  mocks.user = { id: 'user-1' };
  mocks.settingsRow = { ...NEW_HOUSEHOLD_ROW };
  mocks.settingsError = null;
});

describe('householdNeedsSetup (#211)', () => {
  it('is true for a household that has never saved its settings', async () => {
    expect(await householdNeedsSetup()).toBe(true);
  });

  it('is false once settings are saved', async () => {
    mocks.settingsRow = { ...NEW_HOUSEHOLD_ROW, full_settings: { ...DEFAULT_FAMILY_SETTINGS, location: { city: 'Perth', country: 'Australia', hemisphere: 'southern' } } };
    expect(await householdNeedsSetup()).toBe(false);
  });

  it('is false when signed out, the row is missing or the query fails, so nobody is trapped in setup', async () => {
    mocks.user = null;
    expect(await householdNeedsSetup()).toBe(false);
    mocks.user = { id: 'user-1' };
    mocks.settingsRow = null;
    expect(await householdNeedsSetup()).toBe(false);
    mocks.settingsError = { message: 'boom' };
    expect(await householdNeedsSetup()).toBe(false);
  });
});

describe('a new household loads the neutral defaults (#211)', () => {
  it('takes servings from the people, not the column default, and the default cook times', async () => {
    const settings = await loadFamilySettingsFromDb();
    expect(settings).toMatchObject({
      adults: 2,
      children: [],
      totalServings: 2,
      cuisines: [],
      glutenFreePreference: false,
      proteinFocus: false,
      maxCookTime: DEFAULT_FAMILY_SETTINGS.maxCookTime,
      batchCooking: { enabled: false },
      location: { city: '', country: 'Australia' },
    });
  });

  it('keeps a legacy row\'s cook-time preference', async () => {
    mocks.settingsRow = { ...NEW_HOUSEHOLD_ROW, cooking_time_preference: 'standard' };
    expect((await loadFamilySettingsFromDb())?.maxCookTime).toEqual({ weeknight: 60, weekend: 90 });
  });
});

describe('neutral defaults (#211)', () => {
  it('carry no household of their own', () => {
    expect(DEFAULT_FAMILY_SETTINGS).toMatchObject({
      children: [],
      totalServings: DEFAULT_FAMILY_SETTINGS.adults,
      cuisines: [],
      glutenFreePreference: false,
      proteinFocus: false,
      location: { city: '' },
    });
  });

  it('need a city before they can be saved, and nothing else', () => {
    expect(validateFamilySettings(DEFAULT_FAMILY_SETTINGS)).toEqual(['Enter your city']);
    const withCity = { ...DEFAULT_FAMILY_SETTINGS, location: { ...DEFAULT_FAMILY_SETTINGS.location, city: 'Hobart' } };
    expect(validateFamilySettings(withCity)).toEqual([]);
  });

  it('do not put another city in the prompt', () => {
    const prompt = buildRecipeGenerationPrompt({ familySettings: DEFAULT_FAMILY_SETTINGS, numberOfRecipes: 1 });
    expect(prompt).toContain('Location: Australia');
    expect(prompt).not.toContain('Melbourne');
  });
});
