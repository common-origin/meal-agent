/**
 * Coles order history for the extension (#185). Extension token auth.
 *
 * GET: the order ids already imported (so the extension reads only new
 * orders) and the AI match suggestions waiting for the user.
 * POST { orders }: imports past orders, matches their lines to ingredients
 * and updates product memory. Returns { imported, remembered, suggestions }.
 */

import { NextRequest, NextResponse } from 'next/server';
import { householdForExtension } from '@/lib/coles/extensionAuth';
import { parseOrderImport } from '@/lib/coles/orderHistory';
import { importOrders, importedOrderIds, pendingSuggestions } from '@/lib/coles/purchases';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Must stay above AI_TASKS.orderMatch.deadlineMs, so the import's database work still finishes after a slow AI call.
export const maxDuration = 60;

const UNAUTHORISED = { error: 'Extension token not recognised. Copy it again from Settings.' };

export async function GET(request: NextRequest) {
  const householdId = await householdForExtension(request);
  if (!householdId) return NextResponse.json(UNAUTHORISED, { status: 401 });
  try {
    const [orderIds, suggestions] = await Promise.all([importedOrderIds(householdId), pendingSuggestions(householdId)]);
    return NextResponse.json({ importedOrderIds: orderIds, suggestions }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Failed to read Coles order history:', error);
    return NextResponse.json({ error: 'Could not read your order history.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const householdId = await householdForExtension(request);
  if (!householdId) return NextResponse.json(UNAUTHORISED, { status: 401 });
  const orders = parseOrderImport(await request.json().catch(() => null));
  if (!orders) return NextResponse.json({ error: 'Invalid orders.' }, { status: 400 });
  try {
    return NextResponse.json(await importOrders(householdId, orders));
  } catch (error) {
    console.error('Failed to import Coles orders:', error);
    return NextResponse.json({ error: 'Could not save your order history.' }, { status: 500 });
  }
}
