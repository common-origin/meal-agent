/**
 * The signed-in user's household members and pending invites (#217).
 * GET lists them; DELETE ?userId= removes a member (owner) or leaves
 * (your own id). Session-authenticated; migration 015's functions check
 * who may do what.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { householdError, type HouseholdMembersResponse } from '@/lib/household/members';
import { reportErrorAfterResponse } from '@/lib/telemetry/report';

const unauthenticated = () => NextResponse.json({ error: 'Please sign in.' }, { status: 401 });

function errorResponse(error: { message?: string } | null) {
  const { status, message, code } = householdError(error);
  if (status === 500) {
    console.error('household members:', error);
    reportErrorAfterResponse({ source: 'route', route: '/api/household/members', label: 'household-members: request failed', error });
  }
  return NextResponse.json({ error: message, code }, { status });
}

export async function GET() {
  if (!(await getCurrentUser())) return unauthenticated();
  const supabase = await createClient();

  const [members, invites] = await Promise.all([
    supabase.rpc('household_member_list'),
    supabase
      .from('household_invites')
      .select('id, email, expires_at')
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at'),
  ]);
  if (members.error) return errorResponse(members.error);
  if (invites.error) return errorResponse(invites.error);

  const body: HouseholdMembersResponse = {
    members: (members.data ?? []).map((m) => ({
      userId: m.user_id,
      email: m.email,
      role: m.role === 'owner' ? 'owner' : 'member',
      isMe: m.is_me,
    })),
    invites: (invites.data ?? []).map((i) => ({ id: i.id, email: i.email, expiresAt: i.expires_at })),
  };
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE(request: NextRequest) {
  if (!(await getCurrentUser())) return unauthenticated();
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'Missing userId.' }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase.rpc('remove_household_member', { p_user: userId });
  if (error) return errorResponse(error);
  return NextResponse.json({ ok: true });
}
