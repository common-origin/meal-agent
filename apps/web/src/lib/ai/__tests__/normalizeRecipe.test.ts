import { describe, it, expect } from 'vitest';
import { toPageRecipe, toPartialRecipe, toRecipe, recipeId } from '../normalizeRecipe';
import { VALID_TAGS } from '../../tagNormalizer';
import { estimateRecipeCost } from '../../recipeCost';
import { validAiRecipe } from './fixtures';

describe('toRecipe', () => {
  it('maps an AI-generated recipe into the app Recipe shape', () => {
    const recipe = toRecipe(validAiRecipe(), 'ai-generated', { fetchedAt: '2026-10-09T00:00:00.000Z' });
    expect(recipe).toMatchObject({
      title: 'Lemon Chicken Traybake',
      cuisine: 'italian',
      timeMins: 45,
      serves: 4,
      instructions: ['Heat the oven to 200°C.', 'Roast everything for 35 minutes.'],
      nutrition: { calories: 520, protein: 42, carbs: 18, fat: 30 },
      source: { url: '', domain: 'ai-generated', chef: 'AI Generated', license: 'unknown', fetchedAt: '2026-10-09T00:00:00.000Z' },
    });
  });

  it('keeps prep on ingredients that have it, and omits it otherwise', () => {
    const { ingredients } = toRecipe(validAiRecipe(), 'ai-generated');
    expect(ingredients[0]).toEqual({ name: 'chicken thigh fillets', qty: 800, unit: 'g', prep: 'cut into 3cm pieces' });
    expect(ingredients[1]).toEqual({ name: 'garlic clove', qty: 4, unit: 'unit' });
  });

  it('keeps only valid tags', () => {
    const recipe = toRecipe(validAiRecipe(), 'ai-generated');
    expect(recipe.tags.length).toBeGreaterThan(0);
    for (const tag of recipe.tags) expect(VALID_TAGS).toContain(tag);
  });

  it('sets the per-serve cost from Coles prices, not from the model (#89)', () => {
    const recipe = toRecipe(validAiRecipe(), 'ai-generated');
    expect(recipe.costPerServeEst).toBe(estimateRecipeCost(recipe).perServe);
    expect(recipe.costPerServeEst).toBeGreaterThan(0);
  });

  it('drops nutrition with zero calories', () => {
    const recipe = toRecipe(validAiRecipe({ nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 } }), 'ai-generated');
    expect(recipe.nutrition).toBeUndefined();
  });

  it('records the page and extracted source for a user-added recipe', () => {
    const recipe = toRecipe({ ...validAiRecipe(), source: 'RecipeTin Eats' }, 'user-added', {
      sourceUrl: 'https://www.recipetineats.com/chicken-stir-fry/',
    });
    expect(recipe.id).toMatch(/^import-/);
    expect(recipe.source).toMatchObject({
      url: 'https://www.recipetineats.com/chicken-stir-fry/',
      domain: 'recipetineats.com',
      chef: 'RecipeTin Eats',
    });
  });

  it('gives each recipe a unique ID, even with the same title', () => {
    const ids = new Set(Array.from({ length: 50 }, () => toRecipe(validAiRecipe(), 'ai-generated').id));
    expect(ids.size).toBe(50);
  });
});

describe('recipeId (#90)', () => {
  it('gives two recipes with the same title different IDs', () => {
    expect(recipeId('Lemon Chicken')).not.toBe(recipeId('Lemon Chicken'));
  });

  it('matches ai-<slug up to 40>-<8 hex>', () => {
    expect(recipeId('Lemon Chicken')).toMatch(/^ai-lemon-chicken-[0-9a-f]{8}$/);
    const long = recipeId('A Very Long Recipe Title That Keeps Going And Going Past Forty Characters');
    expect(long).toMatch(/^ai-[a-z0-9-]{1,40}-[0-9a-f]{8}$/);
    expect(long).not.toMatch(/--|-{2}[0-9a-f]{8}$/);
  });

  it('falls back to "recipe" for an empty or symbol-only title', () => {
    expect(recipeId('')).toMatch(/^ai-recipe-[0-9a-f]{8}$/);
    expect(recipeId('🍜🔥')).toMatch(/^ai-recipe-[0-9a-f]{8}$/);
  });
});

describe('toPartialRecipe (#92)', () => {
  const { ingredients } = validAiRecipe();

  it('builds a user-added recipe with no method, attributing the source', () => {
    const recipe = toPartialRecipe(
      { title: 'Lemon Chicken Traybake', servings: 4, ingredients, source: 'Family Favourites' },
      { fetchedAt: '2026-10-10T00:00:00.000Z' }
    );
    expect(recipe).toMatchObject({
      title: 'Lemon Chicken Traybake',
      serves: 4,
      instructions: [],
      source: { url: '', domain: 'user-added', chef: 'Family Favourites', fetchedAt: '2026-10-10T00:00:00.000Z' },
    });
    expect(recipe.id).toMatch(/^import-lemon-chicken-traybake-[0-9a-f]{8}$/);
    expect(recipe.ingredients[0]).toEqual({ name: 'chicken thigh fillets', qty: 800, unit: 'g', prep: 'cut into 3cm pieces' });
    expect(recipe.costPerServeEst).toBe(estimateRecipeCost(recipe).perServe);
  });

  it('leaves title, servings and source empty when the photo did not show them', () => {
    const recipe = toPartialRecipe({ ingredients });
    expect(recipe.title).toBe('');
    expect(recipe.serves).toBeUndefined();
    expect(recipe.source.chef).toBe('');
    expect(recipe.id).toMatch(/^import-recipe-[0-9a-f]{8}$/);
  });
});

describe('toPageRecipe (#93)', () => {
  const page = {
    title: 'Simple Tomato Soup',
    serves: 6,
    timeMins: 120,
    instructions: ['Soften the onion.', 'Add the tomatoes and simmer.'],
    ingredientLines: ['1 kg ripe tomatoes'],
    source: 'Example Recipes',
  };

  it('keeps the page fields verbatim and records the final URL as the source', () => {
    const recipe = toPageRecipe(page, validAiRecipe().ingredients, {
      sourceUrl: 'https://www.example.com/soup',
      fetchedAt: '2026-10-10T00:00:00.000Z',
    });
    expect(recipe).toMatchObject({
      title: 'Simple Tomato Soup',
      serves: 6,
      timeMins: 120,
      instructions: page.instructions,
      source: { url: 'https://www.example.com/soup', domain: 'example.com', chef: 'Example Recipes' },
    });
    expect(recipe.ingredients).toHaveLength(3);
    expect(recipe.costPerServeEst).toBe(estimateRecipeCost(recipe).perServe);
  });

  it('accepts no ingredients, for the household to fill in', () => {
    expect(toPageRecipe(page, []).ingredients).toEqual([]);
  });
});
