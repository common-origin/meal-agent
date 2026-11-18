/**
 * POST /api/account/delete { confirmEmail } (#224): deletes the signed-in
 * user's account and data through delete_my_account() (migration 017). The
 * typed confirmation must match their email (or DELETE, for an account with
 * no email), so it can't happen by a stray request.
 * The browser then signs out and clears its cached household data.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { deleteConfirmation } from '@/lib/account/deleteConfirmation';
import { reportErrorAfterResponse } from '@/lib/telemetry/report';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { confirmEmail?: unknown } | null;
  const typed = typeof body?.confirmEmail === 'string' ? body.confirmEmail.trim().toLowerCase() : '';
  if (typed !== deleteConfirmation(user.email).toLowerCase()) {
    return NextResponse.json({ error: "That email doesn't match your account." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_my_account');
  if (error) {
    console.error('account delete:', error);
    reportErrorAfterResponse({ source: 'route', route: '/api/account/delete', label: 'account-delete: request failed', error });
    return NextResponse.json({ error: "Your account couldn't be deleted. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
