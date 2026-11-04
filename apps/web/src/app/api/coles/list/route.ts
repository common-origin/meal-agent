/**
 * The approved shopping list for the Coles extension (#184).
 *
 * PUT  (signed-in session): the shopping-list page saves the week's list
 *      when the user clicks "Shop at Coles".
 * GET  (extension token): the side panel loads the most recently saved list,
 *      with the household's remembered product and pack count for each line.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient, getUserHousehold } from '@/lib/supabase/server';
import { householdForExtension } from '@/lib/coles/extensionAuth';
import {
  packsFor,
  parseColesList,
  type ColesListItem,
  type ExtensionListResponse,
  type RememberedProduct,
} from '@/lib/coles/extensionList';
import type { Json } from '@/lib/supabase/database.types';

export const runtime = 'nodejs';

export async function PUT(request: NextRequest) {
  const household = await getUserHousehold();
  if (!household) {
    return NextResponse.json({ error: 'Sign in with a household to shop at Coles.' }, { status: 401 });
  }

  const list = parseColesList(await request.json().catch(() => null));
  if (!list) {
    return NextResponse.json({ error: 'Invalid shopping list.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('shopping_lists')
    .upsert(
      { household_id: household.household_id, week_start: list.weekStart, items: list.items as unknown as Json },
      { onConflict: 'household_id,week_start' },
    );

  if (error) {
    console.error('Failed to save shopping list for Coles:', error);
    return NextResponse.json({ error: 'Could not save the shopping list.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, count: list.items.length });
}

export async function GET(request: NextRequest) {
  const householdId = await householdForExtension(request);
  if (!householdId) {
    return NextResponse.json({ error: 'Extension token not recognised. Copy it again from Settings.' }, { status: 401 });
  }

  const supabase = createAdminClient();
  // The list most recently sent from the app, whichever week it's for.
  const { data: list, error } = await supabase
    .from('shopping_lists')
    .select('week_start, items')
    .eq('household_id', householdId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'Could not load the shopping list.' }, { status: 500 });
  }
  if (!list) {
    return NextResponse.json({ error: 'No list yet. Click "Shop at Coles" on the shopping list first.' }, { status: 404 });
  }

  const items = (list.items as unknown as ColesListItem[]) ?? [];
  const { data: products } = await supabase
    .from('household_products')
    .select('ingredient_key, product_id, name, url, pack_size, pack_unit, last_price, times_bought')
    .eq('household_id', householdId)
    .in('ingredient_key', items.map(item => item.key));

  const productByKey = new Map<string, RememberedProduct>(
    (products ?? []).map(p => [p.ingredient_key, {
      productId: p.product_id,
      name: p.name,
      url: p.url,
      packSize: p.pack_size,
      packUnit: p.pack_unit,
      lastPrice: p.last_price,
      timesBought: p.times_bought,
    }]),
  );

  const response: ExtensionListResponse = {
    weekStart: list.week_start,
    items: items.map(item => {
      const product = productByKey.get(item.key) ?? null;
      return { ...item, product, packs: packsFor(item, product) };
    }),
  };
  return NextResponse.json(response, { headers: { 'Cache-Control': 'no-store' } });
}
