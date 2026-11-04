/**
 * The signed-in household's Coles extension token (#184), for Settings.
 * GET returns it; POST replaces it, so a lost or shared token stops working.
 * Session-authenticated; RLS scopes both to the user's own household.
 */

import { NextResponse } from 'next/server';
import { createClient, getUserHousehold } from '@/lib/supabase/server';

async function respond(rotate: boolean) {
  const household = await getUserHousehold();
  if (!household) {
    return NextResponse.json({ error: 'Sign in with a household to connect the Coles extension.' }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = rotate
    ? await supabase
        .from('households')
        .update({ extension_token: crypto.randomUUID() })
        .eq('id', household.household_id)
        .select('extension_token')
        .single()
    : await supabase
        .from('households')
        .select('extension_token')
        .eq('id', household.household_id)
        .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Could not load the extension token.' }, { status: 500 });
  }
  return NextResponse.json({ token: data.extension_token }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET() {
  return respond(false);
}

export async function POST() {
  return respond(true);
}
