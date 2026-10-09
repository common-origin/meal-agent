import { describe, it, expect } from 'vitest';
import { AiRecipe, ExtractedRecipe, GeneratedRecipes, PantryScan } from '../schemas';
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
  it('is a list of short ingredient names', () => {
    expect(PantryScan.safeParse({ ingredients: ['milk', 'eggs'] }).success).toBe(true);
    expect(PantryScan.safeParse(['milk']).success).toBe(false);
    expect(PantryScan.safeParse({ ingredients: [''] }).success).toBe(false);
  });
});
