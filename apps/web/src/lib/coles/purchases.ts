/**
 * The order-history import (#185), behind /api/coles/purchases. Saves the
 * past order lines the extension read, matches them to ingredients, and
 * keeps product memory (household_products) pointed at what the household
 * buys most, without touching a product the user chose in the extension.
 *
 * Runs with the service-role client: the extension has no session, and its
 * routes check the household's extension token first.
 */

import { createAdminClient } from '@/lib/supabase/server';
import { INGREDIENT_CATALOGUE, getCatalogueEntry } from '@/lib/ingredients/catalogue';
import { runAiTask } from '@/lib/ai/run';
import { isOverDailyAiCap } from '@/lib/ai/usage';
import { OrderMatches } from '@/lib/ai/schemas';
import { aiRateLimiters } from '@/lib/api/rateLimit';
import { buildOrderMatchPrompt, buildOrderMatchSystemPrompt } from '@/lib/prompts/orderMatch';
import { packSizeOf } from './extensionList';
import {
  catalogueKeyFor,
  historyCutoff,
  ingredientName,
  pickProduct,
  productDisplayName,
  type MatchSuggestion,
  type PastOrder,
  type PurchaseRow,
} from './orderHistory';

type Admin = ReturnType<typeof createAdminClient>;

/** Most products sent to AI in one import; the rest wait for the next. */
const MAX_AI_PRODUCTS = 150;
const PAGE = 1000;

interface HistoryRow extends PurchaseRow {
  ingredient_key: string | null;
  match_status: string;
  suggested_key: string | null;
}

const DECIDED = new Set(['alias', 'suggested', 'confirmed', 'rejected', 'none']);
const MATCHED = ['alias', 'confirmed'];

/** Every purchase_history row for the household, past Supabase's 1,000-row page. */
async function historyRows(supabase: Admin, householdId: string): Promise<HistoryRow[]> {
  const rows: HistoryRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('purchase_history')
      .select('order_id, ordered_at, product_id, name, brand, size, unit_price, ingredient_key, match_status, suggested_key')
      .eq('household_id', householdId)
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

/** Order ids already imported, so the extension only reads new ones. */
export async function importedOrderIds(householdId: string): Promise<string[]> {
  return [...new Set((await historyRows(createAdminClient(), householdId)).map(row => row.order_id))];
}

/** AI suggestions waiting for the user, one per product. */
export async function pendingSuggestions(householdId: string): Promise<MatchSuggestion[]> {
  return suggestionsFrom(await historyRows(createAdminClient(), householdId));
}

function suggestionsFrom(rows: HistoryRow[]): MatchSuggestion[] {
  const byProduct = new Map<string, MatchSuggestion>();
  for (const row of rows) {
    if (row.match_status !== 'suggested' || !row.suggested_key || byProduct.has(row.product_id)) continue;
    byProduct.set(row.product_id, {
      productId: row.product_id,
      productName: productDisplayName(row.brand, row.name),
      key: row.suggested_key,
      ingredientName: ingredientName(row.suggested_key),
    });
  }
  return [...byProduct.values()];
}

/** The member whose AI usage an import counts against: the owner, else the first to join. */
async function householdUserId(supabase: Admin, householdId: string): Promise<string | null> {
  const { data } = await supabase
    .from('household_members')
    .select('user_id, role, joined_at')
    .eq('household_id', householdId)
    .order('joined_at');
  return (data?.find(member => member.role === 'owner') ?? data?.[0])?.user_id ?? null;
}

/**
 * Asks AI which ingredient each unmatched product is. Returns productId →
 * key (or null for "not an ingredient"); products it skipped, or all of
 * them when AI is unavailable or over its limits, stay undecided for the
 * next import.
 */
async function suggestKeys(supabase: Admin, householdId: string, products: HistoryRow[]): Promise<Map<string, string | null>> {
  const decided = new Map<string, string | null>();
  if (products.length === 0) return decided;
  const userId = await householdUserId(supabase, householdId);
  if (!userId || !aiRateLimiters.orderMatch.check(userId) || await isOverDailyAiCap(userId)) return decided;

  try {
    const result = await runAiTask('orderMatch', {
      userId,
      system: buildOrderMatchSystemPrompt(),
      prompt: buildOrderMatchPrompt(
        products.map(row => ({ productId: row.product_id, name: productDisplayName(row.brand, row.name), size: row.size })),
        INGREDIENT_CATALOGUE.map(({ key, name }) => ({ key, name })),
      ),
      schema: OrderMatches,
    });
    if (result.blocked) return decided;
    const asked = new Set(products.map(row => row.product_id));
    for (const { productId, key } of result.output.matches) {
      if (!asked.has(productId)) continue;
      decided.set(productId, key && getCatalogueEntry(key) ? key : null);
    }
  } catch (error) {
    console.error('Coles order match failed; will retry next import:', error);
  }
  return decided;
}

/**
 * Points product memory for each key at the product the household buys
 * most, unless the user chose one in the extension. Returns how many keys
 * it set.
 */
async function rememberMostBought(supabase: Admin, householdId: string, rows: HistoryRow[], keys: Set<string>): Promise<number> {
  if (keys.size === 0) return 0;
  const { data: existing, error } = await supabase
    .from('household_products')
    .select('ingredient_key, product_id, source')
    .eq('household_id', householdId)
    .in('ingredient_key', [...keys]);
  if (error) throw error;
  const chosen = new Set(existing.filter(row => row.source === 'chosen').map(row => row.ingredient_key));
  const current = new Map(existing.map(row => [row.ingredient_key, row.product_id]));

  const upserts = [];
  for (const key of keys) {
    if (chosen.has(key)) continue;
    const picked = pickProduct(rows.filter(row => row.ingredient_key === key && MATCHED.includes(row.match_status)));
    if (!picked) continue;
    const pack = packSizeOf(`${picked.name} ${picked.size ?? ''}`, null);
    upserts.push({
      household_id: householdId,
      ingredient_key: key,
      product_id: picked.productId,
      name: picked.name,
      // Coles redirects /product/<stockcode> to the product's page, which the click fallback needs.
      url: `https://www.coles.com.au/product/${picked.productId}`,
      pack_size: pack?.size ?? null,
      pack_unit: pack?.unit ?? null,
      last_price: picked.lastPrice,
      times_bought: picked.timesBought,
      source: 'imported',
    });
  }
  if (upserts.length === 0) return 0;
  const { error: upsertError } = await supabase.from('household_products').upsert(upserts, { onConflict: 'household_id,ingredient_key' });
  if (upsertError) throw upsertError;
  return upserts.filter(row => current.get(row.ingredient_key) !== row.product_id).length;
}

export interface ImportResult {
  /** Orders newly saved. */
  imported: number;
  /** Ingredients whose remembered product was set or changed. */
  remembered: number;
  suggestions: MatchSuggestion[];
}

/**
 * Saves new past orders, matches their lines, and updates product memory.
 * Safe to call with no orders: it still retries undecided lines with AI
 * and returns the suggestions waiting for the user.
 */
export async function importOrders(householdId: string, orders: PastOrder[], now = new Date()): Promise<ImportResult> {
  const supabase = createAdminClient();
  const cutoff = historyCutoff(now).toISOString();

  const { error: pruneError } = await supabase.from('purchase_history').delete().eq('household_id', householdId).lt('ordered_at', cutoff);
  if (pruneError) throw pruneError;

  const known = new Set((await historyRows(supabase, householdId)).map(row => row.order_id));
  const fresh = orders.filter(order => !known.has(order.orderId) && order.orderedAt >= cutoff);
  const inserts = fresh.flatMap(order => {
    // One row per product per order: Coles can list a product twice (e.g. a substitution).
    const lines = new Map(order.lines.map(line => [line.productId, line]));
    return [...lines.values()].map(line => {
      const key = catalogueKeyFor(line.name);
      return {
        household_id: householdId,
        order_id: order.orderId,
        ordered_at: order.orderedAt,
        product_id: line.productId,
        name: line.name,
        brand: line.brand,
        size: line.size,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        total_price: line.totalPrice,
        ingredient_key: key,
        match_status: key ? 'alias' : 'pending',
      };
    });
  });
  if (inserts.length > 0) {
    const { error } = await supabase
      .from('purchase_history')
      .upsert(inserts, { onConflict: 'household_id,order_id,product_id', ignoreDuplicates: true });
    if (error) throw error;
  }

  let rows = await historyRows(supabase, householdId);

  // A product decided in one order is decided in all of them.
  const decidedByProduct = new Map<string, HistoryRow>();
  for (const row of rows) if (DECIDED.has(row.match_status) && !decidedByProduct.has(row.product_id)) decidedByProduct.set(row.product_id, row);
  const undecided = new Map<string, HistoryRow>();
  for (const row of rows) if (row.match_status === 'pending' && !decidedByProduct.has(row.product_id)) undecided.set(row.product_id, row);
  const toCarry = [...new Set(rows.filter(row => row.match_status === 'pending' && decidedByProduct.has(row.product_id)).map(row => row.product_id))];

  const suggested = await suggestKeys(supabase, householdId, [...undecided.values()].slice(0, MAX_AI_PRODUCTS));

  const updates: { productId: string; values: { ingredient_key: string | null; match_status: string; suggested_key: string | null } }[] = [];
  for (const productId of toCarry) {
    const from = decidedByProduct.get(productId)!;
    updates.push({ productId, values: { ingredient_key: from.ingredient_key, match_status: from.match_status, suggested_key: from.suggested_key } });
  }
  for (const [productId, key] of suggested) {
    updates.push({ productId, values: key ? { ingredient_key: null, match_status: 'suggested', suggested_key: key } : { ingredient_key: null, match_status: 'none', suggested_key: null } });
  }
  for (const { productId, values } of updates) {
    const { error } = await supabase
      .from('purchase_history')
      .update(values)
      .eq('household_id', householdId)
      .eq('product_id', productId)
      .eq('match_status', 'pending');
    if (error) throw error;
  }
  if (updates.length > 0) rows = await historyRows(supabase, householdId);

  const keys = new Set(rows.filter(row => row.ingredient_key && MATCHED.includes(row.match_status)).map(row => row.ingredient_key as string));
  const remembered = await rememberMostBought(supabase, householdId, rows, keys);
  return { imported: fresh.length, remembered, suggestions: suggestionsFrom(rows) };
}

/** Records the user's answer to a suggestion, and on a yes updates product memory for that ingredient. */
export async function confirmMatch(householdId: string, productId: string, key: string, accept: boolean): Promise<{ remembered: number }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('purchase_history')
    .update(accept
      ? { ingredient_key: key, match_status: 'confirmed', suggested_key: null }
      : { ingredient_key: null, match_status: 'rejected' })
    .eq('household_id', householdId)
    .eq('product_id', productId)
    .eq('match_status', 'suggested');
  if (error) throw error;
  if (!accept) return { remembered: 0 };
  const rows = await historyRows(supabase, householdId);
  return { remembered: await rememberMostBought(supabase, householdId, rows, new Set([key])) };
}
