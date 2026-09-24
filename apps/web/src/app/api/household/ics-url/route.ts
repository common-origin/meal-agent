/**
 * Returns the signed-in user's household's ICS calendar feed URL, for
 * display/copy in Settings. Session-authenticated (unlike the feed itself
 * at /api/plan/ics/[token], which is deliberately unauthenticated so an
 * external poller like GAS-ICS-Sync can reach it).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, getUserHousehold } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const household = await getUserHousehold();

  if (!household) {
    return NextResponse.json(
      { error: 'Sign in with a household to get a calendar link.' },
      { status: 401 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('households')
    .select('ics_token')
    .eq('id', household.household_id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: 'Could not load calendar link.' },
      { status: 500 }
    );
  }

  const icsUrl = `${request.nextUrl.origin}/api/plan/ics/${data.ics_token}`;

  return NextResponse.json({ icsUrl });
}
