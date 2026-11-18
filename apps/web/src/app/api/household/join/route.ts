/**
 * Joining a household from an invite link (#217). GET ?token= previews the
 * invite for the signed-in user; POST { token } accepts it, moving them into
 * that household. Migration 015's functions check the invite and the email.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { householdError, type InvitePreview } from '@/lib/household/members';
import { reportErrorAfterResponse } from '@/lib/telemetry/report';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const notFound = (): NextResponse => {
  const { status, message, code } = householdError({ message: 'household:not_found' });
  return NextResponse.json({ error: message, code }, { status });
};

export async function GET(request: NextRequest) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const token = request.nextUrl.searchParams.get('token') ?? '';
  if (!UUID.test(token)) return notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('household_invite_preview', { p_token: token });
  const row = data?.[0];
  if (error || !row) {
    if (error) {
      console.error('household join preview:', error);
      reportErrorAfterResponse({ source: 'route', route: '/api/household/join', label: 'household-join: preview failed', error });
    }
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
  const preview: InvitePreview = {
    status: (['valid', 'accepted', 'expired'] as const).find((s) => s === row.status) ?? 'not_found',
    inviteEmail: row.invite_email,
    inviterEmail: row.inviter_email,
    emailMatches: row.email_matches,
    alreadyMember: row.already_member,
    soleMember: row.sole_member,
  };
  return NextResponse.json(preview, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  const token = typeof body?.token === 'string' ? body.token : '';
  if (!UUID.test(token)) return notFound();

  const supabase = await createClient();
  const { error } = await supabase.rpc('accept_household_invite', { p_token: token });
  if (error) {
    const { status, message, code } = householdError(error);
    if (status === 500) {
      console.error('household join:', error);
      reportErrorAfterResponse({ source: 'route', route: '/api/household/join', label: 'household-join: request failed', error });
    }
    return NextResponse.json({ error: message, code }, { status });
  }
  return NextResponse.json({ ok: true });
}
