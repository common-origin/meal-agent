import { describe, it, expect } from 'vitest';
import { AiRecipe, ExtractedRecipe, GeneratedRecipes, PageIngredients, PantryScan, PhotoIngredients, PhotoRecipe } from '../schemas';
import { validAiRecipe } from './fixtures';

const withIngredient = (ingredient: Record<string, unknown>) =>
  ({ ...validAiRecipe(), ingredients: [ingredient] }) as unknown;

describe('AiRecipe', () => {
  it('accepts a valid recipe, with or without prep', () => {
    expect(AiRecipe.safeParse(validAiRecipe()).success).toBe(true);
    expect(AiRecipe.safeParse(withIngredient({ name: 'salt', qty: 1, unit: 'tsp' })).success).toBe(true);
  });

  it('rejects units outside the five the shopping list understands', () => {
    expect(AiRecipe.safeParse(withIngredient({ name: 'flour', qty: 1, unit: 'cup' })).success).toBe(false);
    expect(AiRecipe.safeParse(withIngredient({ name: 'flour', qty: 1, unit: 'undefined' })).success).toBe(false);
  });

  it('rejects zero, negative and string quantities', () => {
    expect(AiRecipe.safeParse(withIngredient({ name: 'salt', qty: 0, unit: 'tsp' })).success).toBe(false);
    expect(AiRecipe.safeParse(withIngredient({ name: 'salt', qty: -1, unit: 'tsp' })).success).toBe(false);
    expect(AiRecipe.safeParse(withIngredient({ name: 'milk', qty: '1/2', unit: 'ml' })).success).toBe(false);
  });

  it.each(['title', 'cuisine', 'totalTimeMins', 'servings', 'ingredients', 'instructions', 'tags', 'nutrition'] as const)(
    'rejects a recipe missing %s',
    (field) => {
      const recipe: Record<string, unknown> = { ...validAiRecipe() };
      delete recipe[field];
      expect(AiRecipe.safeParse(recipe).success).toBe(false);
    }
  );

  it('rejects a cuisine or tag outside the allowed lists', () => {
    expect(AiRecipe.safeParse({ ...validAiRecipe(), cuisine: 'martian' }).success).toBe(false);
    expect(AiRecipe.safeParse({ ...validAiRecipe(), tags: ['delicious'] }).success).toBe(false);
  });

  it('enforces the size limits', () => {
    expect(AiRecipe.safeParse({ ...validAiRecipe(), title: 'x'.repeat(81) }).success).toBe(false);
    expect(AiRecipe.safeParse({ ...validAiRecipe(), totalTimeMins: 4 }).success).toBe(false);
    expect(AiRecipe.safeParse({ ...validAiRecipe(), servings: 13 }).success).toBe(false);
    expect(AiRecipe.safeParse({ ...validAiRecipe(), instructions: ['Only one step.'] }).success).toBe(false);
    expect(AiRecipe.safeParse({ ...validAiRecipe(), ingredients: [] }).success).toBe(false);
    expect(AiRecipe.safeParse(withIngredient({ name: 'salt', qty: 1, unit: 'tsp', prep: 'x'.repeat(81) })).success).toBe(false);
  });
});

describe('GeneratedRecipes', () => {
  it('needs at least one recipe', () => {
    expect(GeneratedRecipes.safeParse({ recipes: [validAiRecipe()] }).success).toBe(true);
    expect(GeneratedRecipes.safeParse({ recipes: [] }).success).toBe(false);
  });
});

describe('ExtractedRecipe', () => {
  it('allows an optional source', () => {
    expect(ExtractedRecipe.safeParse(validAiRecipe()).success).toBe(true);
    expect(ExtractedRecipe.safeParse({ ...validAiRecipe(), source: 'The Cookbook' }).success).toBe(true);
  });
});

describe('PantryScan', () => {
  const item = (name: string, useSoon = false) => ({ name, useSoon });

  it('is a list of short names, each with a use-soon flag', () => {
    expect(PantryScan.safeParse({ items: [item('milk'), item('baby spinach', true)] }).success).toBe(true);
    expect(PantryScan.safeParse({ items: [{ name: 'milk' }] }).success).toBe(false);
    expect(PantryScan.safeParse({ items: [item('')] }).success).toBe(false);
    expect(PantryScan.safeParse({ ingredients: ['milk'] }).success).toBe(false);
  });

  it('caps names at 40 chars and the list at 40 items', () => {
    expect(PantryScan.safeParse({ items: [item('x'.repeat(40))] }).success).toBe(true);
    expect(PantryScan.safeParse({ items: [item('x'.repeat(41))] }).success).toBe(false);
    expect(PantryScan.safeParse({ items: Array.from({ length: 40 }, (_, i) => item(`item ${i}`)) }).success).toBe(true);
    expect(PantryScan.safeParse({ items: Array.from({ length: 41 }, (_, i) => item(`item ${i}`)) }).success).toBe(false);
  });
});

describe('PhotoRecipe', () => {
  it('caps the paraphrased method at 10 steps', () => {
    const steps = (n: number) => Array.from({ length: n }, (_, i) => `Step ${i + 1}.`);
    expect(PhotoRecipe.safeParse(validAiRecipe({ instructions: steps(10) })).success).toBe(true);
    expect(PhotoRecipe.safeParse(validAiRecipe({ instructions: steps(11) })).success).toBe(false);
  });
});

describe('PhotoIngredients', () => {
  const { ingredients } = validAiRecipe();

  it('needs only ingredients; title, servings and source are optional', () => {
    expect(PhotoIngredients.safeParse({ ingredients }).success).toBe(true);
    expect(PhotoIngredients.safeParse({ title: 'Soup', servings: 4, ingredients, source: 'A Book' }).success).toBe(true);
    expect(PhotoIngredients.safeParse({ title: 'Soup' }).success).toBe(false);
    expect(PhotoIngredients.safeParse({ ingredients: [] }).success).toBe(false);
  });
});

describe('PageIngredients', () => {
  const ingredient = validAiRecipe().ingredients[0];

  it('is up to 40 structured ingredients, possibly none', () => {
    expect(PageIngredients.safeParse({ ingredients: [] }).success).toBe(true);
    expect(PageIngredients.safeParse({ ingredients: Array(40).fill(ingredient) }).success).toBe(true);
    expect(PageIngredients.safeParse({ ingredients: Array(41).fill(ingredient) }).success).toBe(false);
    expect(PageIngredients.safeParse({ ingredients: [{ name: 'flour', qty: 2, unit: 'cup' }] }).success).toBe(false);
  });
});
