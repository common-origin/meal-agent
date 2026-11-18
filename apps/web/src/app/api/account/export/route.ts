/**
 * GET /api/account/export (#224): everything the signed-in user's household
 * has in Supabase, as JSON, for Settings → Your data. Read with the user's
 * session, so RLS decides what's included; see lib/account/export.ts.
 */

import { NextResponse } from 'next/server';
import { createClient, getUserHousehold } from '@/lib/supabase/server';
import { requireUserWithinBurst } from '@/lib/api/guard';
import { accountExportRateLimiter } from '@/lib/api/rateLimit';
import { buildAccountExport } from '@/lib/account/export';
import { reportErrorAfterResponse } from '@/lib/telemetry/report';

export async function GET() {
  // Each export reads every household table, so it's rate limited.
  const guarded = await requireUserWithinBurst(accountExportRateLimiter);
  if (!guarded.ok) return guarded.response;
  const user = guarded.value;
  const household = await getUserHousehold();
  if (!household) return NextResponse.json({ error: "We couldn't find your household." }, { status: 404 });

  try {
    const body = await buildAccountExport(await createClient(), user, household.household_id);
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('account export:', error);
    reportErrorAfterResponse({ source: 'route', route: '/api/account/export', label: 'account-export: request failed', error, householdId: household.household_id });
    return NextResponse.json({ error: "Your data couldn't be exported. Please try again." }, { status: 500 });
  }
}
