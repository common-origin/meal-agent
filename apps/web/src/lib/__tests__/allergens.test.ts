import { describe, it, expect } from 'vitest';
import { findAllergenConflicts } from '../allergens';
import type { Ingredient } from '../types/recipe';

const recipe = (...names: (string | [string, string])[]) => ({
  ingredients: names.map((entry): Ingredient => {
    const [name, prep] = Array.isArray(entry) ? entry : [entry, undefined];
    return { name, qty: 1, unit: 'unit', ...(prep ? { prep } : {}) };
  }),
});

const flagged = (allergies: string[], ...names: (string | [string, string])[]) =>
  findAllergenConflicts(recipe(...names), allergies).map((c) => c.ingredient);

describe('findAllergenConflicts', () => {
  it('is empty when there are no allergies', () => {
    expect(findAllergenConflicts(recipe('peanuts', 'prawns'), [])).toEqual([]);
    expect(findAllergenConflicts(recipe('peanuts'), ['  '])).toEqual([]);
  });

  it('expands common allergens to the ingredients that contain them', () => {
    expect(flagged(['shellfish'], 'king prawns', 'chicken thigh', 'oyster sauce')).toEqual(['king prawns', 'oyster sauce']);
    expect(flagged(['Peanuts'], 'satay sauce', 'rice')).toEqual(['satay sauce']);
    expect(flagged(['sesame'], 'tahini', 'lemon')).toEqual(['tahini']);
    expect(flagged(['dairy'], 'parmesan', 'olive oil', 'Greek yoghurt')).toEqual(['parmesan', 'Greek yoghurt']);
    expect(flagged(['gluten'], 'spaghetti', 'panko breadcrumbs', 'soy sauce', 'rice')).toEqual([
      'spaghetti',
      'panko breadcrumbs',
      'soy sauce',
    ]);
  });

  it('reports the allergy as the household typed it', () => {
    expect(findAllergenConflicts(recipe('cashews'), [' Tree nuts '])).toEqual([{ allergy: 'Tree nuts', ingredient: 'cashews' }]);
  });

  it('takes "nuts" to include peanuts, but "tree nuts" not to', () => {
    expect(flagged(['nuts'], 'peanuts', 'walnuts')).toEqual(['peanuts', 'walnuts']);
    expect(flagged(['tree nuts'], 'peanuts', 'walnuts')).toEqual(['walnuts']);
  });

  it('matches whole words, so lookalikes are not flagged', () => {
    expect(flagged(['nuts'], 'nutmeg', 'coconut milk', 'butternut pumpkin', 'doughnut')).toEqual([]);
    expect(flagged(['egg'], 'eggplant')).toEqual([]);
    expect(flagged(['fish'], 'shellfish stock')).toEqual([]);
  });

  it('allows safe lookalikes and ingredients labelled free of the allergen', () => {
    expect(flagged(['dairy'], 'coconut milk', 'peanut butter', 'butter beans', 'dairy-free cheese')).toEqual([]);
    expect(flagged(['gluten'], 'gluten-free soy sauce', 'rice noodles', 'cornflour', 'rice flour')).toEqual([]);
    // A safe phrase only clears itself, not another match in the same ingredient.
    expect(flagged(['dairy'], 'coconut milk and butter')).toEqual(['coconut milk and butter']);
  });

  it('checks the prep as well as the name', () => {
    expect(flagged(['dairy'], ['potatoes', 'mashed with butter'])).toEqual(['potatoes']);
  });

  it('matches an unlisted allergy as typed, singular or plural', () => {
    expect(flagged(['mustard'], 'Dijon mustard', 'honey')).toEqual(['Dijon mustard']);
    expect(flagged(['kiwis'], 'kiwi fruit')).toEqual(['kiwi fruit']);
    expect(flagged(['celery'], 'celery sticks', 'celeriac')).toEqual(['celery sticks']);
  });
});
