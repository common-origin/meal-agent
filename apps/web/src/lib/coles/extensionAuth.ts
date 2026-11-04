/**
 * Auth for the Coles extension's API calls (#184). The extension has no
 * session, so it sends households.extension_token as a bearer token, the
 * same idea as the ICS feed's token (migration 006) with its own secret.
 * Looked up with the service-role client, since RLS needs a session.
 */

import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function bearerToken(request: Pick<NextRequest, 'headers'>): string | null {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  return token && UUID.test(token) ? token : null;
}

/** The household the request's extension token belongs to, or null. */
export async function householdForExtension(request: Pick<NextRequest, 'headers'>): Promise<string | null> {
  const token = bearerToken(request);
  if (!token) return null;
  const { data } = await createAdminClient()
    .from('households')
    .select('id')
    .eq('extension_token', token)
    .maybeSingle();
  return data?.id ?? null;
}
