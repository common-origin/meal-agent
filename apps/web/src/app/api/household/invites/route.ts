/**
 * Household invites (#217). POST { email } invites someone to the owner's
 * household and emails them a /join/<token> link; DELETE ?id= cancels a
 * pending invite. Migration 015's functions check the caller is the owner.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@/lib/supabase/server';
import { requireUserWithinBurst } from '@/lib/api/guard';
import { householdInviteRateLimiter } from '@/lib/api/rateLimit';
import { householdError } from '@/lib/household/members';
import { inviteEmail } from '@/lib/household/inviteEmail';
import { getSiteUrl } from '@/lib/utils/url';

function errorResponse(error: { message?: string } | null) {
  const { status, message, code } = householdError(error);
  if (status === 500) console.error('household invites:', error);
  return NextResponse.json({ error: message, code }, { status });
}

export async function POST(request: NextRequest) {
  const guarded = await requireUserWithinBurst(householdInviteRateLimiter);
  if (!guarded.ok) return guarded.response;
  const user = guarded.value;

  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  if (!email || email.length > 254) return errorResponse({ message: 'household:invalid_email' });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_household_invite', { p_email: email });
  const invite = data?.[0];
  if (error || !invite) return errorResponse(error);

  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM_ADDRESS;
  const joinUrl = `${getSiteUrl()}/join/${invite.token}`;
  // Without email configured, the invite still exists; the owner can share the link themselves.
  if (!apiKey || !fromAddress) {
    console.warn('household invites: RESEND_API_KEY or RESEND_FROM_ADDRESS unset, invite not emailed');
    return NextResponse.json({ invite: { id: invite.id, email: invite.email, expiresAt: invite.expires_at }, emailed: false, joinUrl });
  }

  const message = inviteEmail(user.email, joinUrl);
  const sent = await new Resend(apiKey)
    .emails.send({ from: fromAddress, to: invite.email, replyTo: user.email, ...message })
    .catch((e: unknown) => ({ error: { message: e instanceof Error ? e.message : String(e) } }));
  if (sent.error) console.error('household invites: email failed', sent.error);

  return NextResponse.json({
    invite: { id: invite.id, email: invite.email, expiresAt: invite.expires_at },
    emailed: !sent.error,
    // Only when the email failed, so the owner can still pass the link on.
    ...(sent.error ? { joinUrl } : {}),
  });
}

export async function DELETE(request: NextRequest) {
  const guarded = await requireUserWithinBurst(householdInviteRateLimiter);
  if (!guarded.ok) return guarded.response;
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_household_invite', { p_invite: id });
  if (error) return errorResponse(error);
  return NextResponse.json({ ok: true });
}
