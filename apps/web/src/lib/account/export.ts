/**
 * Everything a signed-in user's household has in Supabase, for Settings →
 * Your data → Export (#224). Read with the user's own session, so RLS
 * decides what's included; secrets (the calendar and Coles extension
 * tokens, invite links) are left out.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

/** Supabase returns at most 1,000 rows per request; long tables are read in pages. */
const PAGE = 1000;

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Every row a paged query returns, page by page until a short page. */
export async function readAllPages<T>(query: (from: number, to: number) => Page<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

export interface AccountExport {
  exportedAt: string;
  version: 2;
  account: { id: string; email: string | null };
  household: unknown;
  members: unknown[];
  familySettings: unknown;
  recipes: unknown[];
  mealPlans: unknown[];
  shoppingLists: unknown[];
  pantryPreferences: unknown;
  recipeHistory: unknown[];
  favorites: unknown[];
  colesProducts: unknown[];
  colesOrders: unknown[];
  pendingInvites: unknown[];
  aiUsage: unknown[];
}

export async function buildAccountExport(
  supabase: SupabaseClient<Database>,
  user: { id: string; email?: string | null },
  householdId: string,
  now: Date = new Date(),
): Promise<AccountExport> {
  const one = async <T>(query: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T | null> => {
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  };
  const byHousehold = householdId;

  const [
    household, members, familySettings, recipes, mealPlans, shoppingLists, pantryPreferences,
    recipeHistory, favorites, colesProducts, colesOrders, pendingInvites, aiUsage,
  ] = await Promise.all([
    // Name and dates only: not ics_token or extension_token.
    one(supabase.from('households').select('id, name, created_at, updated_at').eq('id', byHousehold).maybeSingle()),
    one(supabase.rpc('household_member_list')),
    one(supabase.from('family_settings').select('*').eq('household_id', byHousehold).maybeSingle()),
    readAllPages((from, to) => supabase.from('recipes').select('*').eq('household_id', byHousehold).order('created_at').range(from, to)),
    readAllPages((from, to) => supabase.from('meal_plans').select('*').eq('household_id', byHousehold).order('week_start').range(from, to)),
    readAllPages((from, to) => supabase.from('shopping_lists').select('*').eq('household_id', byHousehold).order('created_at').range(from, to)),
    one(supabase.from('pantry_preferences').select('*').eq('household_id', byHousehold).maybeSingle()),
    readAllPages((from, to) => supabase.from('recipe_history').select('*').eq('household_id', byHousehold).order('used_at').range(from, to)),
    readAllPages((from, to) => supabase.from('household_favorites').select('*').eq('household_id', byHousehold).order('created_at').range(from, to)),
    readAllPages((from, to) => supabase.from('household_products').select('*').eq('household_id', byHousehold).order('created_at').range(from, to)),
    readAllPages((from, to) => supabase.from('purchase_history').select('*').eq('household_id', byHousehold).order('ordered_at').range(from, to)),
    // Not the token: the link is the invited person's.
    readAllPages((from, to) => supabase.from('household_invites').select('id, email, created_at, expires_at, accepted_at').eq('household_id', byHousehold).order('created_at').range(from, to)),
    // Only the user's own calls, not other members'.
    readAllPages((from, to) => supabase.from('ai_usage').select('*').eq('user_id', user.id).order('created_at').range(from, to)),
  ]);

  return {
    exportedAt: now.toISOString(),
    version: 2,
    account: { id: user.id, email: user.email ?? null },
    household,
    members: members ?? [],
    familySettings,
    recipes,
    mealPlans,
    shoppingLists,
    pantryPreferences,
    recipeHistory,
    favorites,
    colesProducts,
    colesOrders,
    pendingInvites,
    aiUsage,
  };
}
