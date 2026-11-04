/**
 * The shopping list the Coles extension reads (#184), and the product memory
 * it fills. The app saves the approved list here when the user clicks
 * "Shop at Coles"; the extension's side panel pairs each line with the Coles
 * product the household bought for it last time.
 *
 * apps/coles-extension/src/types.ts mirrors ExtensionListItem and
 * ExtensionListResponse; keep the two in step.
 */

import type { AggregatedIngredient } from '../shoppingListAggregator';

/** One line of the approved list, as saved in shopping_lists.items. */
export interface ColesListItem {
  /** Canonical ingredient key (#183); also the product-memory key. */
  key: string;
  name: string;
  category: string;
  /** What the list says to buy, e.g. "2 × 400 g cans". */
  shoppingLabel: string;
  /** Whole packs the list says to buy, when it counts in packs. */
  buyQty?: number;
  /** The quantity needed in g, ml or items, for sizing a remembered product. */
  amount: number;
  amountUnit: string;
}

export interface RememberedProduct {
  productId: string;
  name: string;
  url: string | null;
  packSize: number | null;
  packUnit: string | null;
  lastPrice: number | null;
  timesBought: number;
}

export interface ExtensionListItem extends ColesListItem {
  product: RememberedProduct | null;
  /** How many of the remembered product to add. */
  packs: number;
}

export interface ExtensionListResponse {
  weekStart: string;
  items: ExtensionListItem[];
}

/** The lines to send to Coles: everything not already in the pantry. */
export function toColesListItems(items: AggregatedIngredient[]): ColesListItem[] {
  return items
    .filter(item => !item.isPantryStaple)
    .map(item => ({
      key: item.normalizedName,
      name: item.name,
      category: item.category,
      shoppingLabel: item.shoppingLabel,
      buyQty: item.buyQty,
      amount: item.priceQty,
      amountUnit: item.priceUnit,
    }));
}

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isString = (value: unknown): value is string => typeof value === 'string';

/** Validates a list sent by the app, or returns null. */
export function parseColesList(body: unknown): { weekStart: string; items: ColesListItem[] } | null {
  if (!body || typeof body !== 'object') return null;
  const { weekStart, items } = body as { weekStart?: unknown; items?: unknown };
  if (!isString(weekStart) || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || !Array.isArray(items) || items.length > 500) return null;
  const parsed: ColesListItem[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') return null;
    const item = raw as Record<string, unknown>;
    if (!isString(item.key) || !item.key || !isString(item.name) || !isString(item.category) || !isString(item.shoppingLabel)) return null;
    if (!isFiniteNumber(item.amount) || !isString(item.amountUnit)) return null;
    if (item.buyQty !== undefined && !isFiniteNumber(item.buyQty)) return null;
    parsed.push({
      key: item.key,
      name: item.name,
      category: item.category,
      shoppingLabel: item.shoppingLabel,
      ...(item.buyQty !== undefined ? { buyQty: item.buyQty as number } : {}),
      amount: item.amount,
      amountUnit: item.amountUnit,
    });
  }
  return { weekStart, items: parsed };
}

const PACK_UNITS: Record<string, { base: 'g' | 'ml'; factor: number }> = {
  g: { base: 'g', factor: 1 }, kg: { base: 'g', factor: 1000 },
  ml: { base: 'ml', factor: 1 }, l: { base: 'ml', factor: 1000 },
};

/**
 * The pack size in a Coles product name: "Coles Beef Mince 3 Star 500g" →
 * 500 g, "Coles Diced Tomatoes 4 x 400g" → 1600 g. Null when the name has none.
 */
export function parsePackSize(name: string): { size: number; unit: 'g' | 'ml' } | null {
  const match = name.toLowerCase().match(/(?:(\d+)\s*x\s*)?(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/);
  if (!match) return null;
  const unit = PACK_UNITS[match[3]];
  const count = match[1] ? parseInt(match[1], 10) : 1;
  return { size: parseFloat(match[2]) * unit.factor * count, unit: unit.base };
}

/** The stockcode at the end of a Coles product URL: "/product/coles-bananas-approx.-170g-409499" → "409499". */
export function productIdFromUrl(url: string): string | null {
  return url.match(/\/product\/[^?#]*-(\d+)(?:[?#]|$)/)?.[1] ?? null;
}

/**
 * Packs of the remembered product to add. Lines counted in packs (cans,
 * bunches, items) use the list's own count; lines bought by weight or volume
 * divide by the product's pack size when it's known, and fall back to one.
 */
export function packsFor(item: ColesListItem, product: Pick<RememberedProduct, 'packSize' | 'packUnit'> | null): number {
  if (item.buyQty !== undefined) return Math.max(1, item.buyQty);
  if (product?.packSize && product.packUnit === item.amountUnit && item.amount > 0) {
    return Math.max(1, Math.ceil(item.amount / product.packSize - 1e-6));
  }
  return 1;
}

/** Validates a product the extension saw the user add, or returns null. */
export function parseProductAdd(body: unknown): { ingredientKey: string; productId: string; name: string; url: string | null; price: number | null } | null {
  if (!body || typeof body !== 'object') return null;
  const { ingredientKey, productId, name, url, price } = body as Record<string, unknown>;
  if (!isString(ingredientKey) || !ingredientKey || !isString(productId) || !/^\d+$/.test(productId) || !isString(name) || !name) return null;
  if (url !== undefined && url !== null && (!isString(url) || !url.startsWith('https://www.coles.com.au/'))) return null;
  if (price !== undefined && price !== null && !isFiniteNumber(price)) return null;
  return { ingredientKey, productId, name: name.slice(0, 200), url: (url as string | null | undefined) ?? null, price: (price as number | null | undefined) ?? null };
}
