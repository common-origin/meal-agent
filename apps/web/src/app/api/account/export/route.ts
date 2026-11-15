/**
 * GET /api/account/export (#224): everything the signed-in user's household
 * has in Supabase, as JSON, for Settings → Your data. Read with the user's
 * session, so RLS decides what's included; see lib/account/export.ts.
 */

import { NextResponse } from 'next/server';
import { createClient, getCurrentUser, getUserHousehold } from '@/lib/supabase/server';
import { buildAccountExport } from '@/lib/account/export';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const household = await getUserHousehold();
  if (!household) return NextResponse.json({ error: "We couldn't find your household." }, { status: 404 });

  try {
    const body = await buildAccountExport(await createClient(), user, household.household_id);
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('account export:', error);
    return NextResponse.json({ error: "Your data couldn't be exported. Please try again." }, { status: 500 });
  }
}
