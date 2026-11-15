/**
 * The shared Coles lookup quota (#227). Every household's lookups go through
 * one RapidAPI key, whose plan allows a fixed number of calls a month, so
 * the count lives in the database (api_usage, migration 018), not in each
 * browser. /api/coles-search claims a call before calling RapidAPI, which
 * counts failed calls too. Server only: both functions use the service role.
 */

import { createAdminClient } from '@/lib/supabase/server';

export const COLES_SEARCH_ENDPOINT = 'coles-search';

/** RapidAPI's free plan, unless COLES_API_MONTHLY_LIMIT says otherwise. */
export const DEFAULT_COLES_MONTHLY_LIMIT = 1000;

export interface ColesQuota {
  used: number;
  limit: number;
  remaining: number;
  /** The UTC month counted, YYYY-MM. */
  month: string;
}

/** The monthly limit: COLES_API_MONTHLY_LIMIT when it's a positive whole number, else the default. */
export function colesMonthlyLimit(env: Record<string, string | undefined> = process.env): number {
  const configured = Number(env.COLES_API_MONTHLY_LIMIT);
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_COLES_MONTHLY_LIMIT;
}

/** Midnight UTC on the 1st of `now`'s month, as an ISO string. */
export function startOfUtcMonth(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function quota(used: number, limit: number, now: Date): ColesQuota {
  return { used, limit, remaining: Math.max(0, limit - used), month: startOfUtcMonth(now).slice(0, 7) };
}

/**
 * Claims one lookup for `householdId`:
 * - `granted`: under the limit, and counted;
 * - `exceeded`: the month's total has reached the limit, nothing counted;
 * - `unavailable`: the count couldn't be read or written, so the lookup is
 *   refused (fails closed: an unread limit is no limit).
 */
export type ColesClaim =
  | { status: 'granted' | 'exceeded'; quota: ColesQuota }
  | { status: 'unavailable' };

export async function claimColesLookup(householdId: string, now: Date = new Date()): Promise<ColesClaim> {
  const limit = colesMonthlyLimit();
  try {
    const { data, error } = await createAdminClient().rpc('claim_api_call', {
      p_household: householdId,
      p_endpoint: COLES_SEARCH_ENDPOINT,
      p_limit: limit,
      p_since: startOfUtcMonth(now),
    });
    if (error) throw error;
    const row = data?.[0];
    if (!row) throw new Error('claim_api_call returned no row');
    if (!row.granted) console.warn(JSON.stringify({ type: 'coles_quota_exceeded', used: row.used, limit }));
    return { status: row.granted ? 'granted' : 'exceeded', quota: quota(row.used, limit, now) };
  } catch (error) {
    console.error('coles quota: could not claim a lookup, refusing it (is migration 018 applied?)', error);
    return { status: 'unavailable' };
  }
}

/** This month's lookups across every household, or null if they can't be read. */
export async function readColesQuota(now: Date = new Date()): Promise<ColesQuota | null> {
  try {
    const { data, error } = await createAdminClient().rpc('api_calls_since', {
      p_endpoint: COLES_SEARCH_ENDPOINT,
      p_since: startOfUtcMonth(now),
    });
    if (error) throw error;
    return quota(Number(data ?? 0), colesMonthlyLimit(), now);
  } catch (error) {
    console.error('coles quota: could not read the month\'s lookups (is migration 018 applied?)', error);
    return null;
  }
}
