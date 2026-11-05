/**
 * Coles online order history (#185). The extension reads the household's
 * past orders from coles.com.au; the app keeps their lines in
 * purchase_history and uses them to fill product memory (household_products)
 * with what the household actually buys, at the price it paid.
 *
 * Lines are matched to ingredient keys by catalogue name first. What's left
 * goes to AI for a suggestion, which the user confirms in the extension.
 *
 * apps/coles-extension/src/types.ts mirrors PastOrder, OrderLine and
 * MatchSuggestion; keep them in step.
 */

import { CATALOGUE_NAME_INDEX, getCatalogueEntry } from '../ingredients/catalogue';
import { singularise } from '../ingredients/resolve';

/** How far back history is imported and kept. */
export const HISTORY_MONTHS = 12;
const MAX_ORDERS = 60;
const MAX_LINES = 300;

export interface OrderLine {
  /** Coles stockcode. */
  productId: string;
  name: string;
  brand: string | null;
  /** As Coles shows it: "450g", "approx. 200g", "1.25L". */
  size: string | null;
  quantity: number;
  unitPrice: number | null;
  totalPrice: number | null;
}

export interface PastOrder {
  orderId: string;
  /** ISO timestamp the order was placed. */
  orderedAt: string;
  lines: OrderLine[];
}

/** An AI-suggested match waiting for the user to confirm it. */
export interface MatchSuggestion {
  productId: string;
  /** The product as Coles names it, brand first. */
  productName: string;
  key: string;
  /** The ingredient's display name. */
  ingredientName: string;
}

/** The oldest order date kept: HISTORY_MONTHS before `now`. */
export function historyCutoff(now: Date = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - HISTORY_MONTHS);
  return cutoff;
}

const isString = (value: unknown): value is string => typeof value === 'string';
const optionalString = (value: unknown): string | null => (isString(value) && value ? value.slice(0, 200) : null);
const optionalNumber = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/** Validates past orders sent by the extension, or returns null. */
export function parseOrderImport(body: unknown): PastOrder[] | null {
  if (!body || typeof body !== 'object') return null;
  const { orders } = body as { orders?: unknown };
  if (!Array.isArray(orders) || orders.length > MAX_ORDERS) return null;
  const parsed: PastOrder[] = [];
  for (const raw of orders) {
    if (!raw || typeof raw !== 'object') return null;
    const { orderId, orderedAt, lines } = raw as Record<string, unknown>;
    if (!isString(orderId) || !/^\d+$/.test(orderId) || !isString(orderedAt) || Number.isNaN(Date.parse(orderedAt))) return null;
    if (!Array.isArray(lines) || lines.length > MAX_LINES) return null;
    const parsedLines: OrderLine[] = [];
    for (const rawLine of lines) {
      if (!rawLine || typeof rawLine !== 'object') return null;
      const line = rawLine as Record<string, unknown>;
      if (!isString(line.productId) || !/^\d+$/.test(line.productId) || !isString(line.name) || !line.name) return null;
      const quantity = optionalNumber(line.quantity);
      if (quantity === null || quantity <= 0) return null;
      parsedLines.push({
        productId: line.productId,
        name: line.name.slice(0, 200),
        brand: optionalString(line.brand),
        size: optionalString(line.size),
        quantity,
        unitPrice: optionalNumber(line.unitPrice),
        totalPrice: optionalNumber(line.totalPrice),
      });
    }
    parsed.push({ orderId, orderedAt: new Date(orderedAt).toISOString(), lines: parsedLines });
  }
  return parsed;
}

/** Words Coles puts after what a product is: "Salmon Portions Skin On", "Eggs 12 Pack", "Stock Liquid Salt Reduced". */
const TRAILING_FILLER = new Set([
  'pack', 'packs', 'portion', 'portions', 'skin', 'on', 'off', 'liquid', 'salt', 'reduced', 'value', 'bulk',
  'loose', 'approx', 'each', 'bunch', 'block', 'tub', 'tin', 'can', 'jar', 'bag', 'punnet', 'prepacked',
  'pieces', 'family', 'large', 'medium', 'small', 'star', 'fresh', 'free', 'range', 'australian',
]);

function lookup(phrase: string): string | null {
  for (const candidate of [phrase, singularise(phrase)]) {
    const entry = CATALOGUE_NAME_INDEX.get(candidate);
    if (entry) return entry.key;
  }
  return null;
}

/**
 * The ingredient a Coles product is, by catalogue name: "Perino Red Grape
 * Tomatoes" → tomato, "Chicken Breast Fillets" → chicken breast. Phrases of
 * two or more words can match anywhere, longest first; a single word only
 * as the last word once trailing filler like "Pack" or "Skin On" is dropped,
 * since that's what the product is ("Women's Roll On Deodorant" isn't a
 * bread roll). Null when nothing matches, for AI to try.
 */
export function catalogueKeyFor(productName: string): string | null {
  const words = productName
    .toLowerCase()
    .replace(/\b\d+\s*x\s*\d+(?:\.\d+)?\s*(?:kg|g|ml|l)\b/g, ' ')
    .replace(/\b\d+(?:\.\d+)?\s*(?:kg|g|ml|l)\b/g, ' ')
    .replace(/[^a-z\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  for (let length = words.length; length >= 2; length--) {
    // Rightmost first: the end of a product name says what it is.
    for (let start = words.length - length; start >= 0; start--) {
      const key = lookup(words.slice(start, start + length).join(' '));
      if (key) return key;
    }
  }
  let end = words.length;
  while (end > 1 && TRAILING_FILLER.has(words[end - 1])) end--;
  const last = words[end - 1];
  return last && !TRAILING_FILLER.has(last) ? lookup(last) : null;
}

/** The display name for an ingredient key. */
export function ingredientName(key: string): string {
  return getCatalogueEntry(key)?.name ?? key.charAt(0).toUpperCase() + key.slice(1);
}

/** A purchase_history row, as the import reads it back. */
export interface PurchaseRow {
  order_id: string;
  ordered_at: string;
  product_id: string;
  name: string;
  brand: string | null;
  size: string | null;
  unit_price: number | null;
}

export interface PickedProduct {
  productId: string;
  name: string;
  size: string | null;
  timesBought: number;
  lastPrice: number | null;
}

/**
 * The product a household buys most for one ingredient: the one in the most
 * orders, the most recently bought on a tie. Its price is the latest paid.
 */
export function pickProduct(rows: PurchaseRow[]): PickedProduct | null {
  const byProduct = new Map<string, { orders: Set<string>; latest: PurchaseRow }>();
  for (const row of rows) {
    const seen = byProduct.get(row.product_id);
    if (!seen) {
      byProduct.set(row.product_id, { orders: new Set([row.order_id]), latest: row });
    } else {
      seen.orders.add(row.order_id);
      if (row.ordered_at > seen.latest.ordered_at) seen.latest = row;
    }
  }
  let best: { orders: Set<string>; latest: PurchaseRow } | null = null;
  for (const candidate of byProduct.values()) {
    if (!best
      || candidate.orders.size > best.orders.size
      || (candidate.orders.size === best.orders.size && candidate.latest.ordered_at > best.latest.ordered_at)) {
      best = candidate;
    }
  }
  if (!best) return null;
  const { latest } = best;
  return {
    productId: latest.product_id,
    name: productDisplayName(latest.brand, latest.name),
    size: latest.size,
    timesBought: best.orders.size,
    lastPrice: latest.unit_price,
  };
}

/** "Coles" + "Blueberries" → "Coles Blueberries"; a name that already starts with its brand is left alone. */
export function productDisplayName(brand: string | null, name: string): string {
  if (!brand || name.toLowerCase().startsWith(brand.toLowerCase())) return name;
  return `${brand} ${name}`;
}

/** Validates a match confirmation from the extension, or returns null. */
export function parseMatchConfirmation(body: unknown): { productId: string; key: string; accept: boolean } | null {
  if (!body || typeof body !== 'object') return null;
  const { productId, key, accept } = body as Record<string, unknown>;
  if (!isString(productId) || !/^\d+$/.test(productId) || !isString(key) || !getCatalogueEntry(key) || typeof accept !== 'boolean') return null;
  return { productId, key, accept };
}
