import { describe, it, expect } from 'vitest';
import { familySettingsSchema, generateRecipesSchema } from '../api/schemas';
import { DEFAULT_FAMILY_SETTINGS, type FamilySettings } from '../types/settings';

// What the client actually sends: settings round-tripped through JSON.
const wireSettings = (overrides: Partial<FamilySettings> = {}) =>
  JSON.parse(JSON.stringify({ ...DEFAULT_FAMILY_SETTINGS, ...overrides }));

describe('familySettingsSchema', () => {
  it('accepts the default settings as sent over the wire', () => {
    expect(familySettingsSchema.safeParse(wireSettings()).success).toBe(true);
  });

  it('accepts null for optional fields loaded from storage', () => {
    const settings = { ...wireSettings(), preferredChef: null, customCuisines: null, weeklyReminderDay: null };
    const result = familySettingsSchema.safeParse(settings);
    expect(result.success).toBe(true);
    expect(result.data?.preferredChef).toBeUndefined();
  });

  it('strips fields the prompt never uses, such as saved email recipients', () => {
    const result = familySettingsSchema.safeParse(
      wireSettings({ recipeRecipients: [{ name: 'Sam', email: 'sam@example.com' }] })
    );
    expect(result.data).not.toHaveProperty('recipeRecipients');
  });

  it('enforces the free-text caps', () => {
    expect(familySettingsSchema.safeParse(wireSettings({ preferredChef: 'x'.repeat(100) })).success).toBe(true);
    expect(familySettingsSchema.safeParse(wireSettings({ preferredChef: 'x'.repeat(101) })).success).toBe(false);
    expect(familySettingsSchema.safeParse(wireSettings({ flavorProfileDescription: 'x'.repeat(500) })).success).toBe(true);
    expect(familySettingsSchema.safeParse(wireSettings({ avoidFoods: Array(31).fill('nuts') })).success).toBe(false);
  });
});

describe('generateRecipesSchema', () => {
  it('bounds numberOfRecipes to 1–7', () => {
    const familySettings = wireSettings();
    expect(generateRecipesSchema.safeParse({ familySettings, numberOfRecipes: 0 }).success).toBe(false);
    expect(generateRecipesSchema.safeParse({ familySettings, numberOfRecipes: 7 }).success).toBe(true);
    expect(generateRecipesSchema.safeParse({ familySettings, numberOfRecipes: 8 }).success).toBe(false);
    expect(generateRecipesSchema.safeParse({ familySettings, numberOfRecipes: 2.5 }).success).toBe(false);
  });

  it('accepts a full week of exclusions (20 history + 7 current)', () => {
    const excludeRecipeIds = Array.from({ length: 27 }, (_, i) => `recipe-${i}`);
    expect(generateRecipesSchema.safeParse({ familySettings: wireSettings(), excludeRecipeIds }).success).toBe(true);
  });

  it('allows recipe IDs derived from long titles', () => {
    const excludeRecipeIds = [`ai-${'a'.repeat(150)}`];
    expect(generateRecipesSchema.safeParse({ familySettings: wireSettings(), excludeRecipeIds }).success).toBe(true);
  });

  it('validates specificDays index and type', () => {
    const familySettings = wireSettings();
    expect(generateRecipesSchema.safeParse({ familySettings, specificDays: [{ index: 6, type: 'weekend' }] }).success).toBe(true);
    expect(generateRecipesSchema.safeParse({ familySettings, specificDays: [{ index: 7, type: 'weekend' }] }).success).toBe(false);
    expect(generateRecipesSchema.safeParse({ familySettings, specificDays: [{ index: 0, type: 'brunch' }] }).success).toBe(false);
  });
});
