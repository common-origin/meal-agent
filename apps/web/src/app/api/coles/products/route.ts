/**
 * Product memory for the Coles extension (#184). When the user adds a
 * product to their trolley for a list line, the extension records it here,
 * so next week that line comes pre-ticked with the same product.
 *
 * POST (extension token): { ingredientKey, productId, name, url?, price? }.
 * The same product again counts as another purchase; a different product
 * replaces it, since the household has switched.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { householdForExtension } from '@/lib/coles/extensionAuth';
import { packSizeOf, parseProductAdd } from '@/lib/coles/extensionList';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const householdId = await householdForExtension(request);
  if (!householdId) {
    return NextResponse.json({ error: 'Extension token not recognised. Copy it again from Settings.' }, { status: 401 });
  }

  const add = parseProductAdd(await request.json().catch(() => null));
  if (!add) {
    return NextResponse.json({ error: 'Invalid product.' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from('household_products')
    .select('product_id, times_bought')
    .eq('household_id', householdId)
    .eq('ingredient_key', add.ingredientKey)
    .maybeSingle();

  const pack = packSizeOf(add.name, add.url);
  const { error } = await supabase
    .from('household_products')
    .upsert(
      {
        household_id: householdId,
        ingredient_key: add.ingredientKey,
        product_id: add.productId,
        name: add.name,
        url: add.url,
        pack_size: pack?.size ?? null,
        pack_unit: pack?.unit ?? null,
        last_price: add.price,
        times_bought: existing?.product_id === add.productId ? existing.times_bought + 1 : 1,
        // The user picked it, so order-history imports (#185) leave it alone.
        source: 'chosen',
      },
      { onConflict: 'household_id,ingredient_key' },
    );

  if (error) {
    console.error('Failed to remember Coles product:', error);
    return NextResponse.json({ error: 'Could not save the product.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
