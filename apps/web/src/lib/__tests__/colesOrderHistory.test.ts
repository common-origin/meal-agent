import { describe, it, expect } from 'vitest';
import {
  catalogueKeyFor,
  historyCutoff,
  parseMatchConfirmation,
  parseOrderImport,
  pickProduct,
  productDisplayName,
  type PurchaseRow,
} from '../coles/orderHistory';

describe('catalogueKeyFor (#185)', () => {
  it.each([
    ['Perino Red Grape Tomatoes', 'tomato'],
    ['Chicken Breast Fillets', 'chicken breast'],
    ['Polpa Finely Chopped Tomatoes', 'canned tomato'],
    ['Beef Mince 3 Star', 'beef mince'],
    ['Brown Onions', 'onion'],
    ['Baby Spinach', 'spinach'],
    ['Fresh Tasmanian Salmon Portions Skin On', 'salmon'],
    ['Free Range Eggs 12 Pack', 'egg'],
    ['Basmati Rice 1kg', 'rice'],
  ])('%s → %s', (name, key) => {
    expect(catalogueKeyFor(name)).toBe(key);
  });

  it.each([
    "Women's Roll On Shower Fresh Antiperspirant Deodorant",
    'Earl Grey Loose Leaf Tea',
    'Kombucha Raspberry',
  ])('leaves %s for AI', name => {
    expect(catalogueKeyFor(name)).toBeNull();
  });
});

describe('parseOrderImport', () => {
  const line = { productId: '3571948', name: 'Blueberries', brand: 'Coles', size: '170g', quantity: 1, unitPrice: 4.4, totalPrice: 4.4 };

  it('accepts orders the extension read', () => {
    expect(parseOrderImport({ orders: [{ orderId: '283923910', orderedAt: '2026-10-25T09:00:00+11:00', lines: [line] }] })).toEqual([
      { orderId: '283923910', orderedAt: '2026-10-24T22:00:00.000Z', lines: [line] },
    ]);
  });

  it('keeps missing details as null', () => {
    const [order] = parseOrderImport({ orders: [{ orderId: '1', orderedAt: '2026-10-25', lines: [{ productId: '2', name: 'Milk', quantity: 2 }] }] }) ?? [];
    expect(order.lines[0]).toEqual({ productId: '2', name: 'Milk', brand: null, size: null, quantity: 2, unitPrice: null, totalPrice: null });
  });

  it.each([
    ['no orders list', {}],
    ['a non-numeric order id', { orders: [{ orderId: 'abc', orderedAt: '2026-10-25', lines: [] }] }],
    ['a bad date', { orders: [{ orderId: '1', orderedAt: 'last week', lines: [] }] }],
    ['a non-numeric product id', { orders: [{ orderId: '1', orderedAt: '2026-10-25', lines: [{ ...line, productId: 'x' }] }] }],
    ['a zero quantity', { orders: [{ orderId: '1', orderedAt: '2026-10-25', lines: [{ ...line, quantity: 0 }] }] }],
  ])('rejects %s', (_label, body) => {
    expect(parseOrderImport(body)).toBeNull();
  });
});

describe('pickProduct', () => {
  const row = (product_id: string, order_id: string, ordered_at: string, unit_price = 4): PurchaseRow => ({
    order_id, ordered_at, product_id, name: `Product ${product_id}`, brand: 'Coles', size: '500g', unit_price,
  });

  it('picks the product in the most orders, at its latest price', () => {
    expect(pickProduct([
      row('1', 'a', '2026-09-01', 4),
      row('1', 'b', '2026-10-01', 4.5),
      row('2', 'c', '2026-10-20'),
    ])).toEqual({ productId: '1', name: 'Coles Product 1', size: '500g', timesBought: 2, lastPrice: 4.5 });
  });

  it('breaks a tie with the most recent', () => {
    expect(pickProduct([row('1', 'a', '2026-09-01'), row('2', 'b', '2026-10-01')])?.productId).toBe('2');
  });

  it('is null with no rows', () => {
    expect(pickProduct([])).toBeNull();
  });
});

describe('productDisplayName', () => {
  it('puts the brand first unless the name already has it', () => {
    expect(productDisplayName('Coles', 'Blueberries')).toBe('Coles Blueberries');
    expect(productDisplayName('Coles', 'Coles Blueberries')).toBe('Coles Blueberries');
    expect(productDisplayName(null, 'Blueberries')).toBe('Blueberries');
  });
});

describe('historyCutoff', () => {
  it('is 12 months back', () => {
    expect(historyCutoff(new Date('2026-11-05T00:00:00Z')).toISOString()).toBe('2025-11-05T00:00:00.000Z');
  });
});

describe('parseMatchConfirmation', () => {
  it('accepts a known ingredient key', () => {
    expect(parseMatchConfirmation({ productId: '1', key: 'garlic', accept: true })).toEqual({ productId: '1', key: 'garlic', accept: true });
  });

  it('rejects an unknown key or missing answer', () => {
    expect(parseMatchConfirmation({ productId: '1', key: 'not an ingredient', accept: true })).toBeNull();
    expect(parseMatchConfirmation({ productId: '1', key: 'garlic' })).toBeNull();
  });
});
