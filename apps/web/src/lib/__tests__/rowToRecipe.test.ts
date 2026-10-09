import { describe, it, expect } from 'vitest';
import { rowToRecipe } from '../supabaseStorage';

const baseRow = {
  id: 'ai-lemon-chicken',
  household_id: 'household-1',
  title: 'Lemon Chicken',
  source_url: null,
  source_domain: 'ai-generated',
  source_chef: 'AI Generated',
  time_mins: 40,
  serves: 4,
  tags: ['chicken'],
  ingredients: [{ name: 'chicken thigh', qty: 800, unit: 'g' }],
  instructions: ['Cook it.', 'Serve it.'],
  cost_per_serve_est: 5.5,
  nutrition: null,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
};

describe('rowToRecipe', () => {
  it('loads a recipe saved before #84 (no cuisine, no ingredient prep)', () => {
    const recipe = rowToRecipe({ ...baseRow, cuisine: null } as never);
    expect(recipe.cuisine).toBeUndefined();
    expect(recipe.ingredients).toEqual([{ name: 'chicken thigh', qty: 800, unit: 'g' }]);
    expect(recipe).toMatchObject({ id: 'ai-lemon-chicken', title: 'Lemon Chicken', timeMins: 40, serves: 4, costPerServeEst: 5.5 });
    expect(recipe.source).toMatchObject({ url: '', domain: 'ai-generated', chef: 'AI Generated' });
  });

  it('loads cuisine and ingredient prep when present', () => {
    const recipe = rowToRecipe({
      ...baseRow,
      cuisine: 'italian',
      ingredients: [{ name: 'chicken thigh', qty: 800, unit: 'g', prep: 'diced' }],
    } as never);
    expect(recipe.cuisine).toBe('italian');
    expect(recipe.ingredients[0].prep).toBe('diced');
  });
});
