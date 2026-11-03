import { describe, it, expect } from 'vitest';
import { resolveIngredient, ingredientKey, singularise } from '../ingredients/resolve';
import { getCatalogueEntry } from '../ingredients/catalogue';
import { buyQuantity, parseUnit, pricingForIngredient, toBaseQuantity } from '../ingredients/quantity';
import { COLES_INGREDIENT_MAPPINGS } from '../colesMapping';

describe('resolveIngredient (#183)', () => {
  it.each([
    ['Garlic cloves, minced', 'garlic'],
    ['3 garlic cloves', 'garlic'],
    ['Onions', 'onion'],
    ['Brown onion', 'onion'],
    ['Onion, sliced', 'onion'],
    ['Red onion', 'red onion'],
    ['Limes', 'lime'],
    ['Juice of lime', 'lime'],
    ['Chicken thighs', 'chicken thigh'],
    ['Chicken thigh fillets', 'chicken thigh'],
    ['Boneless skinless chicken thighs', 'chicken thigh'],
    ['Coriander leaves', 'coriander'],
    ['Fresh coriander', 'coriander'],
    ['Parmesan cheese', 'parmesan'],
    ['Parmesan, grated', 'parmesan'],
    ['Tinned tomatoes', 'canned tomato'],
    ['Canned diced tomatoes', 'canned tomato'],
    ['Ground beef', 'beef mince'],
    ['Extra virgin olive oil', 'olive oil'],
    ['Coarsely chopped flat-leaf parsley', 'parsley'],
    ['Finely grated zest of 1 lemon', 'lemon'],
    ['Sun-dried tomatoes', 'sun-dried tomato'],
  ])('%s → %s', (name, key) => {
    expect(ingredientKey(name)).toBe(key);
  });

  it('keeps tinned and fresh tomatoes apart', () => {
    expect(ingredientKey('Diced tomatoes')).toBe('canned tomato');
    expect(ingredientKey('Fresh tomatoes, diced')).toBe('tomato');
    expect(ingredientKey('Tomatoes')).toBe('tomato');
  });

  it('keeps ground spices apart from the fresh herb', () => {
    expect(ingredientKey('Ground coriander')).toBe('ground coriander');
    expect(ingredientKey('Ground ginger')).toBe('ground ginger');
    expect(ingredientKey('Fresh ginger, grated')).toBe('ginger');
  });

  it('strips every descriptor, not just the first', () => {
    expect(ingredientKey('Fresh finely chopped flat leaf parsley')).toBe('parsley');
    expect(ingredientKey('Large ripe avocados')).toBe('avocado');
  });

  it('resolves every Coles-mapped ingredient to its own key, so pricing coverage never drops', () => {
    for (const { normalizedName } of COLES_INGREDIENT_MAPPINGS) {
      expect(ingredientKey(normalizedName)).toBe(normalizedName);
    }
  });

  it('falls back to the cleaned singular name for unknown ingredients', () => {
    expect(resolveIngredient('Fresh dragonfruit slices')).toEqual({ key: 'dragonfruit slice', displayName: 'Dragonfruit slices' });
    expect(resolveIngredient('')).toBeNull();
  });
});

describe('singularise', () => {
  it.each([
    ['tomatoes', 'tomato'], ['leaves', 'leaf'], ['berries', 'berry'], ['peaches', 'peach'],
    ['garlic cloves', 'garlic clove'], ['asparagus', 'asparagus'], ['hummus', 'hummus'],
  ])('%s → %s', (plural, single) => {
    expect(singularise(plural)).toBe(single);
  });
});

describe('ingredient quantities', () => {
  const garlic = getCatalogueEntry('garlic');
  const tomatoes = getCatalogueEntry('canned tomato');

  it('reads pack sizes written into the unit', () => {
    expect(parseUnit('x 400g tins')).toEqual({ unit: 'g', multiplier: 400 });
    expect(parseUnit('Tablespoons')).toEqual({ unit: 'tbsp', multiplier: 1 });
    expect(parseUnit('')).toEqual({ unit: '', multiplier: 1 });
  });

  it('converts recipe units with per-ingredient conversions', () => {
    expect(toBaseQuantity(garlic, 1, 'tbsp')).toEqual({ measure: 'count', amount: 3 });
    expect(toBaseQuantity(garlic, 2, 'cloves')).toEqual({ measure: 'count', amount: 2 });
    expect(toBaseQuantity(tomatoes, 1, 'can')).toEqual({ measure: 'mass', amount: 400 });
    expect(toBaseQuantity(tomatoes, 2, 'x 400g tins')).toEqual({ measure: 'mass', amount: 800 });
  });

  it('returns null when a unit has no conversion', () => {
    expect(toBaseQuantity(getCatalogueEntry('beef mince'), 1, 'sprig')).toBeNull();
    expect(toBaseQuantity(undefined, 1, 'pinch')).toBeNull();
  });

  it('infers the measure from the unit for unknown ingredients', () => {
    expect(toBaseQuantity(undefined, 2, 'tbsp')).toEqual({ measure: 'volume', amount: 30 });
    expect(toBaseQuantity(undefined, 3, 'pieces')).toEqual({ measure: 'count', amount: 3 });
  });

  it('rounds up to whole packs', () => {
    expect(buyQuantity(garlic, 'count', 11)).toEqual({ qty: 2, label: '2 bulbs' });
    expect(buyQuantity(tomatoes, 'mass', 800)).toEqual({ qty: 2, label: '2 × 400 g cans' });
    expect(buyQuantity(getCatalogueEntry('lime'), 'count', 1.5)).toEqual({ qty: 2, label: '2' });
    expect(buyQuantity(getCatalogueEntry('beef mince'), 'mass', 500)).toBeNull();
  });

  it('prices counted items by weight where the weight is known', () => {
    expect(pricingForIngredient('Garlic cloves', 4, 'clove')).toEqual({ key: 'garlic', qty: 20, unit: 'g' });
    expect(pricingForIngredient('Chicken thighs', 2, 'kg')).toEqual({ key: 'chicken thigh', qty: 2000, unit: 'g' });
    expect(pricingForIngredient('Saffron', 1, 'pinch')).toEqual({ key: 'saffron', qty: 1, unit: 'pinch' });
  });
});

describe('display names', () => {
  it('uses the recipe wording for ingredients without a hand-written name', () => {
    expect(resolveIngredient('Prawns')).toMatchObject({ key: 'prawn', displayName: 'Prawns' });
    expect(resolveIngredient('Mild curry powder')).toMatchObject({ key: 'curry powder', displayName: 'Curry powder' });
  });

  it('uses the catalogue name for hand-written entries', () => {
    expect(resolveIngredient('garlic cloves, minced')?.displayName).toBe('Garlic');
  });
});
