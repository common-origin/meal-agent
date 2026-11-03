import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecipeLibrary } from '../library';
import { aggregateShoppingList, type AggregatedIngredient } from '../shoppingListAggregator';
import type { PlanWeek, Recipe } from '../types/recipe';

vi.mock('../analytics', () => ({ track: vi.fn() }));

type Row = [name: string, qty: number, unit: string];

function recipe(id: string, rows: Row[]): Recipe {
  return {
    id,
    title: id,
    serves: 4,
    ingredients: rows.map(([name, qty, unit]) => ({ name, qty, unit })),
  } as Recipe;
}

let recipes: Record<string, Recipe> = {};

function aggregate(ids: string[], options?: Parameters<typeof aggregateShoppingList>[1]): AggregatedIngredient[] {
  const plan = { days: ids.map(recipeId => ({ recipeId, scaledServings: 4 })) } as unknown as PlanWeek;
  return aggregateShoppingList(plan, options);
}

function byKey(list: AggregatedIngredient[]): Record<string, AggregatedIngredient> {
  return Object.fromEntries(list.map(item => [item.normalizedName, item]));
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(RecipeLibrary, 'getById').mockImplementation((id: string) => recipes[id]);
});

describe('aggregateShoppingList (#183)', () => {
  // The week from #183's reproduction: 10 things to buy, which used to come out as 20 lines.
  const week: Record<string, Recipe> = {
    Tacos: recipe('Tacos', [
      ['Garlic cloves, minced', 2, 'clove'], ['Brown onion', 1, ''], ['Beef mince', 500, 'g'],
      ['Diced tomatoes', 400, 'g'], ['Fresh coriander', 1, 'bunch'], ['Lime', 2, ''],
    ]),
    Curry: recipe('Curry', [
      ['Garlic', 1, 'tbsp'], ['Onions', 2, ''], ['Chicken thighs', 600, 'g'],
      ['Canned diced tomatoes', 1, 'can'], ['Coriander leaves', 0.25, 'cup'], ['Limes', 1, ''],
    ]),
    'Stir fry': recipe('Stir fry', [
      ['Garlic', 3, 'clove'], ['Onion, sliced', 1, 'medium'], ['Chicken thigh fillets', 4, ''], ['Soy sauce', 2, 'tbsp'],
    ]),
    Pasta: recipe('Pasta', [
      ['Garlic', 2, 'tsp'], ['Red onion', 0.5, ''], ['Tinned tomatoes', 2, 'x 400g tins'],
      ['Parmesan, grated', 50, 'g'], ['Parmesan cheese', 0.5, 'cup'],
    ]),
  };

  it('turns the reproduction week into one line per ingredient', () => {
    recipes = week;
    const list = aggregate(Object.keys(week));

    expect(list).toHaveLength(10);
    expect(Object.fromEntries(list.map(item => [item.name, item.buyLabel ?? item.quantityLabel]))).toEqual({
      'Garlic': '1 bulb', // 2 + 3 + 3 (1 tbsp) + 2 (2 tsp) = 10 cloves
      'Brown onion': '4',
      'Red onion': '1',
      'Tinned tomatoes': '4 × 400 g cans',
      'Coriander': '2 bunches',
      'Limes': '3',
      'Beef mince': '500 g',
      'Chicken thigh fillets': '1.2 kg',
      'Parmesan': '100 g',
      'Soy sauce': '30 ml',
    });
  });

  it('keeps the recipe total alongside the buy quantity', () => {
    recipes = week;
    const items = byKey(aggregate(Object.keys(week)));

    expect(items['garlic'].quantityLabel).toBe('10 cloves');
    expect(items['garlic'].sourceRecipes).toHaveLength(4);
    expect(items['coriander'].quantityLabel).toBe('1.3 bunches');
    expect(items['canned tomato'].quantityLabel).toBe('1.6 kg');
    expect(items['onion'].buyLabel).toBe('4');
  });

  it('prices in units the Coles pack sizes understand', () => {
    recipes = week;
    const items = byKey(aggregate(Object.keys(week)));

    expect(items['garlic']).toMatchObject({ priceQty: 50, priceUnit: 'g' });
    expect(items['chicken thigh']).toMatchObject({ priceQty: 1200, priceUnit: 'g' });
    expect(items['soy sauce']).toMatchObject({ priceQty: 30, priceUnit: 'ml' });
  });

  it('adds up repeated odd units instead of overwriting them', () => {
    // Before #183, a third occurrence in a second unit replaced the earlier line.
    recipes = {
      a: recipe('a', [['Saffron', 1, 'g']]),
      b: recipe('b', [['Saffron', 1, 'pinch']]),
      c: recipe('c', [['Saffron', 2, 'pinch']]),
    };
    const [saffron, ...rest] = aggregate(['a', 'b', 'c']);

    expect(rest).toHaveLength(0);
    expect(saffron.quantityLabel).toBe('1 g + 3 pinch');
    expect(saffron.extraQuantities).toEqual([{ qty: 3, unit: 'pinch' }]);
  });

  it('keeps a "bunch" a bunch', () => {
    recipes = { a: recipe('a', [['Fresh mint', 1, 'bunch']]) };
    expect(aggregate(['a'])[0].buyLabel).toBe('1 bunch');
  });

  it('shows unconvertible quantities as written when nothing converts', () => {
    recipes = { a: recipe('a', [['Saffron threads', 1, 'pinch']]) };
    const [saffron] = aggregate(['a']);
    expect(saffron.quantityLabel).toBe('1 pinch');
    expect(saffron.extraQuantities).toEqual([]);
  });

  it('matches pantry preferences saved under old-style names', () => {
    localStorage.setItem('user_pantry_preferences', JSON.stringify(['onions']));
    recipes = { a: recipe('a', [['Brown onion', 1, '']]) };
    expect(aggregate(['a'])[0].isPantryStaple).toBe(true);
  });

  it('flags items already in the week’s pantry', () => {
    recipes = { a: recipe('a', [['Limes', 2, '']]) };
    const [lime] = aggregate(['a'], { userPantryItems: [{ name: 'lime', qty: 3, unit: '' }] });
    expect(lime.isPantryStaple).toBe(true);
  });
});
