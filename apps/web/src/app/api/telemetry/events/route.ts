/**
 * POST /api/telemetry/events (admin dashboard, #247): a batch of anonymous
 * product events, stored in product_events.
 *
 * Signed-in users only, with a burst limit. A batch is at most 20 events and
 * about 8 KB. Every event is checked against the strict per-type schema in
 * lib/telemetry/productEvents.ts, so an unknown key or a stray string rejects
 * the whole batch with 400. The household comes from the session, never the
 * body, and no user id is stored. The write is best-effort and tolerates a
 * missing table.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireUserWithinBurst } from '@/lib/api/guard';
import { productEventsRateLimiter } from '@/lib/api/rateLimit';
import { aiErrorResponse } from '@/lib/ai/errors';
import { runAfterResponse } from '@/lib/adminAlerts';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { eventBatchSchema } from '@/lib/telemetry/productEvents';
import { release } from '@/lib/telemetry/release';
import type { Json } from '@/lib/supabase/database.types';

export const runtime = 'nodejs';

export const MAX_BODY_BYTES = 8192;

export async function POST(request: NextRequest) {
  const guarded = await requireUserWithinBurst(productEventsRateLimiter);
  if (!guarded.ok) return guarded.response;

  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return aiErrorResponse('invalid_request');
  const text = await request.text().catch(() => '');
  if (text.length === 0 || new TextEncoder().encode(text).length > MAX_BODY_BYTES) return aiErrorResponse('invalid_request');

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return aiErrorResponse('invalid_request');
  }
  const parsed = eventBatchSchema.safeParse(json);
  if (!parsed.success) return aiErrorResponse('invalid_request');

  const events = parsed.data.events;
  const sha = release();
  runAfterResponse(async () => {
    try {
      const { data: householdId } = await (await createClient()).rpc('get_user_household_id');
      // Without a household there is nothing to attribute the events to.
      if (typeof householdId !== 'string') return;
      const rows = events.map((event) => ({ household_id: householdId, type: event.type, props: event.props as Json, release: sha }));
      const { error } = await createAdminClient().from('product_events').insert(rows);
      if (error) console.warn('product_events insert failed (is migration 020 applied?):', error.message);
    } catch (e) {
      console.warn('product_events insert failed:', e instanceof Error ? e.message : String(e));
    }
  });
  return NextResponse.json({ ok: true }, { status: 202 });
}
