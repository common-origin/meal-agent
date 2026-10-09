import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Recipe } from '@/lib/types/recipe';

const recipes = vi.hoisted(() => new Map<string, Recipe>());
vi.mock('@/lib/library', () => ({ RecipeLibrary: { getById: (id: string) => recipes.get(id) } }));

import BudgetSummary from '../BudgetSummary';

function recipe(id: string, ingredients: Recipe['ingredients']): Recipe {
  return {
    id,
    title: id,
    source: { url: '', domain: 'ai-generated', chef: 'AI Generated', license: 'unknown', fetchedAt: '2026-10-09T00:00:00Z' },
    tags: [],
    ingredients,
    serves: 4,
    costPerServeEst: 5,
  };
}

const meal = (recipeId: string) => ({ recipeId, title: recipeId }) as never;

function renderPlan(...ids: string[]) {
  render(
    <BudgetSummary weekPlan={ids.map(meal)} budget={{ current: 40, total: 120 }} dayNames={['Monday', 'Tuesday', 'Wednesday']} />
  );
}

beforeEach(() => {
  recipes.clear();
  recipes.set('mapped', recipe('mapped', [
    { name: 'chicken thigh', qty: 800, unit: 'g' },
    { name: 'garlic', qty: 4, unit: 'unit' },
  ]));
  recipes.set('unmapped', recipe('unmapped', [
    { name: 'dragonfruit essence', qty: 1, unit: 'tsp' },
    { name: 'moon salt', qty: 1, unit: 'tsp' },
  ]));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('BudgetSummary cost label (#89)', () => {
  it('labels a well-priced plan as estimated from Coles prices', () => {
    renderPlan('mapped');
    expect(screen.getByText('Estimated from Coles prices')).toBeInTheDocument();
    expect(screen.queryByText('Rough estimate: some ingredients unpriced')).not.toBeInTheDocument();
  });

  it('flags a plan with under 70% of ingredients priced as a rough estimate', () => {
    renderPlan('mapped', 'unmapped'); // 2 of 4 priced
    expect(screen.getByText('Rough estimate: some ingredients unpriced')).toBeInTheDocument();
  });

  it('still shows the budget figures', () => {
    renderPlan('mapped');
    expect(screen.getByText('$40.00 / $120.00')).toBeInTheDocument();
  });
});
