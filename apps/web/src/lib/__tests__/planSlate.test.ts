import { describe, it, expect } from 'vitest';
import {
  allowedProteins,
  buildDaySlot,
  buildWeekSlate,
  LOW_CLEANUP_METHODS,
  MAX_PANTRY_FOCUS,
  MAX_PROTEIN_PER_WEEK,
  VEGETARIAN_NIGHT,
  type WeekSlateInput,
} from '../planSlate';
import { DEFAULT_FAMILY_SETTINGS, type FamilySettings } from '../types/settings';

const settings = (overrides: Partial<FamilySettings> = {}): WeekSlateInput['settings'] => ({
  ...DEFAULT_FAMILY_SETTINGS,
  ...overrides,
});
const input = (overrides: Partial<WeekSlateInput> = {}): WeekSlateInput => ({
  settings: settings(),
  cuisines: ['italian', 'mexican', 'thai'],
  seed: 42,
  ...overrides,
});
const SEEDS = Array.from({ length: 200 }, (_, i) => i * 7919 + 1);
const consecutivePairs = <T,>(values: T[]) => values.slice(1).map((value, i) => [values[i], value] as const);
const countOf = (values: string[]) => values.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map<string, number>());

describe('buildWeekSlate (#95)', () => {
  it('returns 7 days, weeknights Monday–Friday and weekends on indices 5 and 6', () => {
    const slate = buildWeekSlate(input());
    expect(slate.map((d) => d.index)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(slate.map((d) => d.type)).toEqual(['weeknight', 'weeknight', 'weeknight', 'weeknight', 'weeknight', 'weekend', 'weekend']);
  });

  it('is deterministic for a fixed seed and varies across seeds', () => {
    expect(buildWeekSlate(input({ seed: 7 }))).toEqual(buildWeekSlate(input({ seed: 7 })));
    const weeks = new Set(SEEDS.map((seed) => JSON.stringify(buildWeekSlate(input({ seed })))));
    expect(weeks.size).toBeGreaterThan(10);
  });

  describe('cuisine', () => {
    it.each([2, 3, 5])('never repeats on consecutive days with %i cuisines selected', (n) => {
      const cuisines = ['italian', 'mexican', 'thai', 'indian', 'greek'].slice(0, n);
      for (const seed of SEEDS) {
        const days = buildWeekSlate(input({ cuisines, seed })).map((d) => d.cuisine);
        for (const [a, b] of consecutivePairs(days)) expect(a).not.toBe(b);
        expect(days.every((c) => c !== null && cuisines.includes(c))).toBe(true);
      }
    });

    it('uses the one cuisine every day when only one is selected, and null when none', () => {
      expect(new Set(buildWeekSlate(input({ cuisines: ['italian'] })).map((d) => d.cuisine))).toEqual(new Set(['italian']));
      expect(buildWeekSlate(input({ cuisines: [] })).every((d) => d.cuisine === null)).toBe(true);
    });

    it('prefers cuisines not eaten last week', () => {
      for (const seed of SEEDS.slice(0, 50)) {
        const slate = buildWeekSlate(input({ cuisines: ['italian', 'mexican', 'thai'], recentCuisines: ['italian'], seed }));
        expect(slate[0].cuisine).not.toBe('italian');
        expect(slate.filter((d) => d.cuisine === 'italian')).toHaveLength(2); // last in the rotation: days 2 and 5
      }
    });
  });

  describe('protein', () => {
    it.each(['omnivore', 'flexitarian', 'pescatarian', 'vegetarian', 'vegan'] as const)(
      '%s: within the diet, at most %s a week where the diet allows, never on consecutive days',
      (dietaryType) => {
        const allowed = allowedProteins(settings({ dietaryType }));
        for (const seed of SEEDS) {
          const proteins = buildWeekSlate(input({ settings: settings({ dietaryType }), seed })).map((d) => d.protein);
          expect(proteins.every((p) => allowed.includes(p))).toBe(true);
          for (const [a, b] of consecutivePairs(proteins)) expect(a).not.toBe(b);
          // Only cap-able when the diet has enough proteins: 7 days / 2 per protein needs 4.
          if (allowed.length >= 4) {
            for (const count of countOf(proteins).values()) expect(count).toBeLessThanOrEqual(MAX_PROTEIN_PER_WEEK);
          }
        }
      }
    );

    it('omnivore weeks include exactly one vegetarian night', () => {
      for (const seed of SEEDS) {
        const proteins = buildWeekSlate(input({ seed })).map((d) => d.protein);
        expect(proteins.filter((p) => p === VEGETARIAN_NIGHT)).toHaveLength(1);
      }
    });

    it('flexitarian weeks have meat or fish on at most 2 nights', () => {
      for (const seed of SEEDS) {
        const proteins = buildWeekSlate(input({ settings: settings({ dietaryType: 'flexitarian' }), seed })).map((d) => d.protein);
        expect(proteins.filter((p) => p === 'chicken' || p === 'fish').length).toBeLessThanOrEqual(2);
      }
    });

    it('honours diet, dairy-free, allergies and avoid-foods', () => {
      expect(allowedProteins(settings({ dietaryType: 'vegetarian', dairyFree: true }))).toEqual(['eggs', 'legumes', 'tofu']);
      expect(allowedProteins(settings({ allergies: ['Shellfish'], avoidFoods: ['pork'] }))).toEqual([
        'chicken', 'beef', 'lamb', 'fish', VEGETARIAN_NIGHT,
      ]);
      expect(allowedProteins(settings({ dietaryType: 'vegan', allergies: ['soy'] }))).toEqual(['legumes', 'seitan']);
      // A fish allergy isn't a shellfish allergy, so seafood stays.
      expect(allowedProteins(settings({ dietaryType: 'pescatarian', allergies: ['eggs', 'fish'] }))).toEqual(['seafood', 'legumes', 'tofu']);
      // Whole words only: a peanut allergy keeps legumes; red meat rules out beef and lamb.
      expect(allowedProteins(settings({ dietaryType: 'vegan', allergies: ['peanuts'] }))).toContain('legumes');
      expect(allowedProteins(settings({ avoidFoods: ['red meat'] }))).not.toEqual(expect.arrayContaining(['beef']));
      expect(allowedProteins(settings({ avoidFoods: ['red meat'] }))).not.toContain('lamb');
      for (const seed of SEEDS) {
        const proteins = buildWeekSlate(input({ settings: settings({ allergies: ['fish', 'shellfish'] }), seed })).map((d) => d.protein);
        expect(proteins).not.toContain('fish');
        expect(proteins).not.toContain('seafood');
      }
    });

    it('still fills every day, without consecutive repeats, when the diet allows only two proteins', () => {
      const tight = settings({ dietaryType: 'vegan', allergies: ['soy'] });
      for (const seed of SEEDS) {
        const proteins = buildWeekSlate(input({ settings: tight, seed })).map((d) => d.protein);
        expect(proteins).toHaveLength(7);
        for (const [a, b] of consecutivePairs(proteins)) expect(a).not.toBe(b);
      }
    });
  });

  describe('method', () => {
    it('never repeats on consecutive days, and only weekends slow-cook', () => {
      for (const seed of SEEDS) {
        const slate = buildWeekSlate(input({ seed }));
        for (const [a, b] of consecutivePairs(slate.map((d) => d.method))) expect(a).not.toBe(b);
        expect(slate.slice(0, 5).some((d) => d.method === 'slow-cook')).toBe(false);
      }
    });

    it('keeps weeknights to one-pot, bake and bowl with minimal clean-up', () => {
      for (const seed of SEEDS) {
        const slate = buildWeekSlate(input({ settings: settings({ effortPreference: 'minimal_clean_up' }), seed }));
        expect(slate.slice(0, 5).every((d) => LOW_CLEANUP_METHODS.includes(d.method))).toBe(true);
        for (const [a, b] of consecutivePairs(slate.map((d) => d.method))) expect(a).not.toBe(b);
      }
    });
  });

  describe('pantryFocus', () => {
    it('puts use-soon items on Monday–Wednesday', () => {
      const slate = buildWeekSlate(
        input({ pantryItems: ['rice', 'spinach', 'eggs', 'milk'], useSoonItems: ['spinach', 'chicken thighs', 'cream'] })
      );
      const days = (item: string) => slate.filter((d) => d.pantryFocus.includes(item)).map((d) => d.index);
      for (const item of ['spinach', 'chicken thighs', 'cream']) {
        expect(days(item)).toHaveLength(1);
        expect(days(item)[0]).toBeLessThanOrEqual(2);
      }
    });

    it('spreads the rest across the week, each item once, at most 3 per day', () => {
      const pantryItems = Array.from({ length: 12 }, (_, i) => `item ${i}`);
      const slate = buildWeekSlate(input({ pantryItems, useSoonItems: ['item 0', 'Item 1'] }));
      expect(slate.every((d) => d.pantryFocus.length <= MAX_PANTRY_FOCUS)).toBe(true);
      const placed = slate.flatMap((d) => d.pantryFocus.map((i) => i.toLowerCase()));
      expect(new Set(placed).size).toBe(placed.length);
      expect(placed).toHaveLength(12);
      expect(slate.slice(0, 3).flatMap((d) => d.pantryFocus)).toEqual(expect.arrayContaining(['item 0', 'Item 1']));
    });

    it('puts a protein pantry item only on a day with that protein', () => {
      for (const seed of SEEDS) {
        const slate = buildWeekSlate(
          input({ pantryItems: ['chicken thighs', 'broccoli', 'firm tofu', 'prawns'], useSoonItems: ['chicken thighs'], seed })
        );
        for (const day of slate) {
          if (day.pantryFocus.includes('chicken thighs')) expect(day.protein).toBe('chicken');
          if (day.pantryFocus.includes('prawns')) expect(day.protein).toBe('seafood');
          if (day.pantryFocus.includes('firm tofu')) expect(['tofu', VEGETARIAN_NIGHT]).toContain(day.protein);
        }
        // Use-soon meat is cooked early: the week is arranged so a chicken day falls on Monday–Wednesday.
        expect(slate.find((d) => d.pantryFocus.includes('chicken thighs'))?.index).toBeLessThanOrEqual(2);
        for (const [a, b] of consecutivePairs(slate.map((d) => d.protein))) expect(a).not.toBe(b);
      }
    });

    it('leaves a protein item out of the focus when no day has that protein', () => {
      const slate = buildWeekSlate(input({ settings: settings({ dietaryType: 'vegetarian' }), pantryItems: ['chicken thighs', 'eggs'] }));
      expect(slate.flatMap((d) => d.pantryFocus)).toEqual(['eggs']);
    });

    it('drops what doesn\'t fit rather than exceeding 3 per day', () => {
      const pantryItems = Array.from({ length: 30 }, (_, i) => `item ${i}`);
      const slate = buildWeekSlate(input({ pantryItems }));
      expect(slate.flatMap((d) => d.pantryFocus)).toHaveLength(21);
    });
  });
});

describe('buildDaySlot (#95)', () => {
  it('builds one day that differs from its neighbours and avoids proteins already used twice', () => {
    const weekProteins = ['chicken', 'beef', null, 'pork', 'chicken', 'fish', 'lamb'];
    const weekCuisines = ['italian', 'mexican', null, 'thai', 'italian', 'mexican', 'thai'];
    for (const seed of SEEDS) {
      const slot = buildDaySlot({ ...input({ seed }), index: 2, weekProteins, weekCuisines });
      expect(slot).toMatchObject({ index: 2, type: 'weeknight' });
      expect(['beef', 'pork', 'chicken']).not.toContain(slot.protein);
      expect(['mexican', 'thai']).not.toContain(slot.cuisine);
    }
  });

  it('is a weekend slot on Saturday and gives use-soon items to an early day', () => {
    expect(buildDaySlot({ ...input(), index: 5 }).type).toBe('weekend');
    expect(buildDaySlot({ ...input({ useSoonItems: ['spinach'] }), index: 0 }).pantryFocus).toEqual(['spinach']);
  });
});
