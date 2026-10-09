import { describe, it, expect } from 'vitest';
import { getCurrentSeason, getInSeasonIngredients } from '../seasonal';

describe('getCurrentSeason', () => {
  it('accepts an explicit month', () => {
    expect(getCurrentSeason('southern', 9)).toBe('spring'); // October
    expect(getCurrentSeason('northern', 9)).toBe('autumn');
    expect(getCurrentSeason('southern', 0)).toBe('summer');
  });
});

describe('getInSeasonIngredients', () => {
  it('lists southern-hemisphere spring produce for October', () => {
    const produce = getInSeasonIngredients('southern', 9);
    expect(produce).toEqual(expect.arrayContaining(['asparagus', 'peas', 'spinach', 'strawberry']));
    expect(produce).not.toContain('pumpkin');
  });

  it('flips for the northern hemisphere', () => {
    expect(getInSeasonIngredients('northern', 9)).toEqual(expect.arrayContaining(['pumpkin', 'apple']));
  });

  it('caps the list', () => {
    expect(getInSeasonIngredients('southern', 0).length).toBeLessThanOrEqual(12);
    expect(getInSeasonIngredients('southern', 0, 3)).toHaveLength(3);
  });

  it('leaves out non-Australian synonyms, generic groups and year-round staples', () => {
    const all = [...Array(12).keys()].flatMap((month) => getInSeasonIngredients('southern', month, 100));
    for (const name of ['courgette', 'aubergine', 'bell pepper', 'citrus', 'berry', 'onion', 'garlic', 'potato']) {
      expect(all).not.toContain(name);
    }
  });

  it('gives grapefruit its own months, not grape’s', () => {
    // Grapefruit is winter (northern Dec–Feb); grape is northern Sep–Oct.
    expect(getInSeasonIngredients('northern', 8, 100)).not.toContain('grapefruit');
    expect(getInSeasonIngredients('northern', 0, 100)).toContain('grapefruit');
  });
});
