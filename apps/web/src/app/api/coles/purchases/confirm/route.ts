/**
 * Confirms or rejects an AI match suggestion from the order-history import
 * (#185). Extension token auth.
 *
 * POST { productId, key, accept }: on accept, every purchase of the product
 * counts towards that ingredient and product memory is updated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { householdForExtension } from '@/lib/coles/extensionAuth';
import { parseMatchConfirmation } from '@/lib/coles/orderHistory';
import { confirmMatch } from '@/lib/coles/purchases';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const householdId = await householdForExtension(request);
  if (!householdId) {
    return NextResponse.json({ error: 'Extension token not recognised. Copy it again from Settings.' }, { status: 401 });
  }
  const answer = parseMatchConfirmation(await request.json().catch(() => null));
  if (!answer) return NextResponse.json({ error: 'Invalid answer.' }, { status: 400 });
  try {
    return NextResponse.json(await confirmMatch(householdId, answer.productId, answer.key, answer.accept));
  } catch (error) {
    console.error('Failed to confirm Coles match:', error);
    return NextResponse.json({ error: 'Could not save that answer.' }, { status: 500 });
  }
}
