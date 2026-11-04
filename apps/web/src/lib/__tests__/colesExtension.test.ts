import { describe, it, expect } from 'vitest';
import {
  packsFor,
  parseColesList,
  parsePackSize,
  parseProductAdd,
  productIdFromUrl,
  toColesListItems,
  type ColesListItem,
} from '../coles/extensionList';
import { bearerToken } from '../coles/extensionAuth';
import type { AggregatedIngredient } from '../shoppingListAggregator';

const line = (overrides: Partial<ColesListItem> = {}): ColesListItem => ({
  key: 'beef mince', name: 'Beef mince', category: 'Meat & Seafood', shoppingLabel: '750 g', amount: 750, amountUnit: 'g', ...overrides,
});

describe('toColesListItems (#184)', () => {
  it('sends what to buy, leaving out the pantry', () => {
    const items = [
      { normalizedName: 'garlic', name: 'Garlic', category: 'Fresh Produce', shoppingLabel: '1 bulb', buyQty: 1, priceQty: 50, priceUnit: 'g', isPantryStaple: false },
      { normalizedName: 'rice', name: 'Rice', category: 'Pantry', shoppingLabel: '500 g', priceQty: 500, priceUnit: 'g', isPantryStaple: true },
    ] as AggregatedIngredient[];
    expect(toColesListItems(items)).toEqual([
      { key: 'garlic', name: 'Garlic', category: 'Fresh Produce', shoppingLabel: '1 bulb', buyQty: 1, amount: 50, amountUnit: 'g' },
    ]);
  });
});

describe('parseColesList', () => {
  it('accepts a list the app sends', () => {
    const list = { weekStart: '2026-11-09', items: [line({ buyQty: 2 })] };
    expect(parseColesList(list)).toEqual(list);
  });

  it.each([
    ['no body', null],
    ['a bad date', { weekStart: 'next week', items: [] }],
    ['items that are not a list', { weekStart: '2026-11-09', items: 'garlic' }],
    ['an item without a key', { weekStart: '2026-11-09', items: [line({ key: '' })] }],
    ['a non-numeric amount', { weekStart: '2026-11-09', items: [{ ...line(), amount: '750' }] }],
  ])('rejects %s', (_label, body) => {
    expect(parseColesList(body)).toBeNull();
  });
});

describe('parsePackSize', () => {
  it.each([
    ['Coles Beef Mince 3 Star 500g', { size: 500, unit: 'g' }],
    ['Coles Diced Tomatoes 4 x 400g', { size: 1600, unit: 'g' }],
    ['Coles Full Cream Milk 2L', { size: 2000, unit: 'ml' }],
    ['Coles Potatoes Brushed 2kg', { size: 2000, unit: 'g' }],
    ['Coles Bananas approx. 170g', { size: 170, unit: 'g' }],
  ])('%s', (name, pack) => {
    expect(parsePackSize(name)).toEqual(pack);
  });

  it('is null when the name has no size', () => {
    expect(parsePackSize('Coles Coriander Bunch')).toBeNull();
  });
});

describe('packsFor', () => {
  it('uses the list’s own count for lines bought in packs', () => {
    expect(packsFor(line({ buyQty: 3 }), { packSize: 400, packUnit: 'g' })).toBe(3);
  });

  it('divides by the remembered pack size for lines bought by weight', () => {
    expect(packsFor(line(), { packSize: 500, packUnit: 'g' })).toBe(2);
    expect(packsFor(line({ amount: 1000 }), { packSize: 500, packUnit: 'g' })).toBe(2);
  });

  it('falls back to one pack when the sizes can’t be compared', () => {
    expect(packsFor(line(), null)).toBe(1);
    expect(packsFor(line(), { packSize: 1000, packUnit: 'ml' })).toBe(1);
  });
});

describe('product memory input', () => {
  it('reads the stockcode from a product URL', () => {
    expect(productIdFromUrl('https://www.coles.com.au/product/coles-bananas-approx.-170g-409499')).toBe('409499');
    expect(productIdFromUrl('/product/coles-bananas-approx.-170g-409499?pid=x')).toBe('409499');
    expect(productIdFromUrl('https://www.coles.com.au/search/products?q=bananas')).toBeNull();
  });

  it('accepts a product the extension saw added', () => {
    expect(parseProductAdd({ ingredientKey: 'banana', productId: '409499', name: 'Coles Bananas', url: 'https://www.coles.com.au/product/coles-bananas-409499', price: 0.77 }))
      .toEqual({ ingredientKey: 'banana', productId: '409499', name: 'Coles Bananas', url: 'https://www.coles.com.au/product/coles-bananas-409499', price: 0.77 });
  });

  it('rejects URLs off coles.com.au and ids that aren’t stockcodes', () => {
    expect(parseProductAdd({ ingredientKey: 'banana', productId: '409499', name: 'x', url: 'https://evil.example/' })).toBeNull();
    expect(parseProductAdd({ ingredientKey: 'banana', productId: 'abc', name: 'x' })).toBeNull();
  });
});

describe('bearerToken', () => {
  const request = (value?: string) => ({ headers: new Headers(value ? { authorization: value } : {}) });

  it('reads a UUID bearer token', () => {
    expect(bearerToken(request('Bearer 3f2504e0-4f89-41d3-9a0c-0305e82c3301'))).toBe('3f2504e0-4f89-41d3-9a0c-0305e82c3301');
  });

  it('ignores anything else', () => {
    expect(bearerToken(request())).toBeNull();
    expect(bearerToken(request('Bearer not-a-token'))).toBeNull();
    expect(bearerToken(request('Basic 3f2504e0-4f89-41d3-9a0c-0305e82c3301'))).toBeNull();
  });
});
