/**
 * GET /api/health (#248): public, and deliberately thin. It reports the latest
 * stored health check as `{ status, checkedAt, release }` with no per-check
 * detail, and never runs a live check, so hitting it costs one indexed select.
 *
 * status: 'ok' or 'failing' from the latest row, or 'unknown' when there is
 * no row yet (or the table isn't there).
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    const { data, error } = await createAdminClient()
      .from('health_checks')
      .select('ok, created_at, release')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return NextResponse.json({ status: 'unknown', checkedAt: null, release: null }, { headers });
    return NextResponse.json(
      { status: data.ok ? 'ok' : 'failing', checkedAt: data.created_at, release: data.release },
      { headers }
    );
  } catch (e) {
    console.warn('health: could not read the latest check:', e instanceof Error ? e.message : String(e));
    return NextResponse.json({ status: 'unknown', checkedAt: null, release: null }, { headers });
  }
}
