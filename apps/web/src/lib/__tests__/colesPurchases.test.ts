import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PastOrder } from '../coles/orderHistory';

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};

/** Just enough of the Supabase query builder for lib/coles/purchases.ts, over in-memory tables. */
function query(table: string) {
  const filters: ((row: Row) => boolean)[] = [];
  let action: { kind: 'select' } | { kind: 'delete' } | { kind: 'update'; values: Row } = { kind: 'select' };
  let range: [number, number] | null = null;
  const rows = () => (tables[table] ??= []);
  const builder = {
    select: () => builder,
    order: () => builder,
    eq: (column: string, value: unknown) => { filters.push(row => row[column] === value); return builder; },
    lt: (column: string, value: string) => { filters.push(row => String(row[column]) < value); return builder; },
    in: (column: string, values: unknown[]) => { filters.push(row => values.includes(row[column])); return builder; },
    range: (from: number, to: number) => { range = [from, to]; return builder; },
    delete: () => { action = { kind: 'delete' }; return builder; },
    update: (values: Row) => { action = { kind: 'update', values }; return builder; },
    upsert: (incoming: Row[], { onConflict, ignoreDuplicates }: { onConflict: string; ignoreDuplicates?: boolean }) => {
      const keys = onConflict.split(',');
      for (const row of incoming) {
        const existing = rows().find(r => keys.every(k => r[k] === row[k]));
        if (!existing) rows().push({ id: `${table}-${rows().length}`, ...row });
        else if (!ignoreDuplicates) Object.assign(existing, row);
      }
      return Promise.resolve({ error: null });
    },
    then: (resolve: (value: { data: Row[] | null; error: null }) => unknown) => {
      const matching = rows().filter(row => filters.every(filter => filter(row)));
      if (action.kind === 'delete') {
        tables[table] = rows().filter(row => !matching.includes(row));
        return resolve({ data: null, error: null });
      }
      if (action.kind === 'update') {
        const { values } = action;
        matching.forEach(row => Object.assign(row, values));
        return resolve({ data: null, error: null });
      }
      return resolve({ data: range ? matching.slice(range[0], range[1] + 1) : matching, error: null });
    },
  };
  return builder;
}

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => ({ from: query }) }));
const runAiTask = vi.fn();
vi.mock('@/lib/ai/run', () => ({ runAiTask: (...args: unknown[]) => runAiTask(...args) }));
vi.mock('@/lib/ai/usage', () => ({ isOverDailyAiCap: async () => false }));

const { importOrders, confirmMatch } = await import('../coles/purchases');

const HOUSEHOLD = 'h1';
const NOW = new Date('2026-11-05T00:00:00Z');

const order = (orderId: string, orderedAt: string, lines: [string, string, number?][]): PastOrder => ({
  orderId,
  orderedAt,
  lines: lines.map(([productId, name, unitPrice = 3]) => ({ productId, name, brand: 'Coles', size: '500g', quantity: 1, unitPrice, totalPrice: unitPrice })),
});

const products = () => tables.household_products ?? [];

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key];
  tables.household_members = [{ household_id: HOUSEHOLD, user_id: 'u1', role: 'owner', joined_at: '2026-01-01' }];
  runAiTask.mockReset();
  runAiTask.mockResolvedValue({ blocked: false, output: { matches: [] } });
});

describe('importOrders (#185)', () => {
  it('remembers the most-bought product for catalogue matches', async () => {
    const result = await importOrders(HOUSEHOLD, [
      order('1', '2026-10-01T00:00:00.000Z', [['11', 'Beef Mince 3 Star'], ['20', 'Brown Onions']]),
      order('2', '2026-10-08T00:00:00.000Z', [['11', 'Beef Mince 3 Star', 3.5]]),
      order('3', '2026-10-15T00:00:00.000Z', [['12', 'Beef Mince Premium']]),
    ], NOW);

    expect(result).toMatchObject({ imported: 3, remembered: 2, suggestions: [] });
    expect(products().find(p => p.ingredient_key === 'beef mince')).toMatchObject({
      product_id: '11', name: 'Coles Beef Mince 3 Star', times_bought: 2, last_price: 3.5, source: 'imported',
      url: 'https://www.coles.com.au/product/11', pack_size: 500, pack_unit: 'g',
    });
  });

  it('never replaces a product the user chose', async () => {
    tables.household_products = [{ household_id: HOUSEHOLD, ingredient_key: 'onion', product_id: '99', source: 'chosen' }];
    await importOrders(HOUSEHOLD, [order('1', '2026-10-01T00:00:00.000Z', [['20', 'Brown Onions']])], NOW);
    expect(products()).toEqual([{ household_id: HOUSEHOLD, ingredient_key: 'onion', product_id: '99', source: 'chosen' }]);
  });

  it('skips orders already imported and older than 12 months, and prunes old rows', async () => {
    tables.purchase_history = [{ household_id: HOUSEHOLD, order_id: 'old', ordered_at: '2025-01-01T00:00:00.000Z', product_id: '1', match_status: 'none' }];
    await importOrders(HOUSEHOLD, [order('1', '2026-10-01T00:00:00.000Z', [['20', 'Brown Onions']])], NOW);
    const again = await importOrders(HOUSEHOLD, [
      order('1', '2026-10-01T00:00:00.000Z', [['20', 'Brown Onions']]),
      order('2', '2025-06-01T00:00:00.000Z', [['20', 'Brown Onions']]),
    ], NOW);

    expect(again.imported).toBe(0);
    expect(tables.purchase_history.map(row => row.order_id)).toEqual(['1']);
  });

  it('asks AI about unmatched products once, and keeps its suggestions for the user', async () => {
    runAiTask.mockResolvedValue({ blocked: false, output: { matches: [
      { productId: '30', key: 'cheese' },
      { productId: '31', key: null },
      { productId: '32', key: 'not a real key' },
    ] } });
    const result = await importOrders(HOUSEHOLD, [order('1', '2026-10-01T00:00:00.000Z', [
      ['30', 'Dairy Cheese Tasty'], ['31', 'Kombucha Raspberry'], ['32', 'Mystery Item'],
    ])], NOW);

    expect(runAiTask).toHaveBeenCalledTimes(1);
    expect(result.suggestions).toEqual([{ productId: '30', productName: 'Coles Dairy Cheese Tasty', key: 'cheese', ingredientName: expect.any(String) }]);
    expect(tables.purchase_history.map(row => [row.product_id, row.match_status])).toEqual([['30', 'suggested'], ['31', 'none'], ['32', 'none']]);
    expect(products()).toEqual([]);

    // A later order of the same product carries the decision; AI isn't asked again.
    runAiTask.mockClear();
    await importOrders(HOUSEHOLD, [order('2', '2026-10-08T00:00:00.000Z', [['30', 'Dairy Cheese Tasty']])], NOW);
    expect(runAiTask).not.toHaveBeenCalled();
    expect(tables.purchase_history.filter(row => row.product_id === '30').map(row => row.match_status)).toEqual(['suggested', 'suggested']);
  });

  it('matches to the household’s list keys, and moves earlier matches onto them', async () => {
    await importOrders(HOUSEHOLD, [order('1', '2026-10-01T00:00:00.000Z', [['40', 'Baby Spinach 120g']])], NOW);
    expect(tables.purchase_history[0]).toMatchObject({ ingredient_key: 'spinach', match_status: 'alias' });

    tables.shopping_lists = [{ household_id: HOUSEHOLD, items: [{ key: 'baby spinach' }, { key: 'garlic' }] }];
    const result = await importOrders(HOUSEHOLD, [order('2', '2026-10-08T00:00:00.000Z', [['41', 'Cherry Tomatoes Punnet']])], NOW);

    expect(tables.purchase_history.map(row => [row.product_id, row.ingredient_key])).toEqual([['40', 'baby spinach'], ['41', 'tomato']]);
    expect(products().find(p => p.ingredient_key === 'baby spinach')).toMatchObject({ product_id: '40' });
    expect(result.remembered).toBe(2);
  });

  it('offers AI the list keys and accepts them back', async () => {
    tables.shopping_lists = [{ household_id: HOUSEHOLD, items: [{ key: 'black pepper' }] }];
    runAiTask.mockResolvedValue({ blocked: false, output: { matches: [{ productId: '50', key: 'black pepper' }] } });
    const result = await importOrders(HOUSEHOLD, [order('1', '2026-10-01T00:00:00.000Z', [['50', 'Cracked Pepper Grinder']])], NOW);

    expect(runAiTask.mock.calls[0][1].prompt).toContain('black pepper');
    expect(result.suggestions).toEqual([expect.objectContaining({ productId: '50', key: 'black pepper', ingredientName: 'Black pepper' })]);
  });

  it('leaves products undecided when AI fails, to retry next import', async () => {
    runAiTask.mockRejectedValue(new Error('timeout'));
    const result = await importOrders(HOUSEHOLD, [order('1', '2026-10-01T00:00:00.000Z', [['30', 'Dairy Cheese Tasty']])], NOW);
    expect(result.imported).toBe(1);
    expect(tables.purchase_history[0].match_status).toBe('pending');
  });
});

describe('confirmMatch', () => {
  beforeEach(async () => {
    runAiTask.mockResolvedValue({ blocked: false, output: { matches: [{ productId: '30', key: 'cheese' }] } });
    await importOrders(HOUSEHOLD, [order('1', '2026-10-01T00:00:00.000Z', [['30', 'Dairy Cheese Tasty']])], NOW);
  });

  it('on yes, matches the product and remembers it', async () => {
    expect(await confirmMatch(HOUSEHOLD, '30', 'cheese', true)).toEqual({ remembered: 1 });
    expect(tables.purchase_history[0]).toMatchObject({ ingredient_key: 'cheese', match_status: 'confirmed' });
    expect(products()[0]).toMatchObject({ ingredient_key: 'cheese', product_id: '30', source: 'imported' });
  });

  it('on no, rejects it and remembers nothing', async () => {
    expect(await confirmMatch(HOUSEHOLD, '30', 'cheese', false)).toEqual({ remembered: 0 });
    expect(tables.purchase_history[0]).toMatchObject({ ingredient_key: null, match_status: 'rejected' });
    expect(products()).toEqual([]);
  });
});
