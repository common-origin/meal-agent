/**
 * Supabase Client for Browser/Client Components
 * 
 * Use this client in Client Components (components with 'use client')
 * This client handles authentication state and cookies automatically.
 */

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  // Create a singleton client for better performance
  if (client) {
    return client;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local file.'
    );
  }

  client = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);

  return client;
}

let inFlightUser: ReturnType<typeof fetchCurrentUser> | null = null;

async function fetchCurrentUser() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('Error fetching user:', error);
    return null;
  }

  return user;
}

/**
 * Get the current authenticated user.
 *
 * getUser() is a real network round-trip to Supabase Auth (deliberately, so
 * it re-verifies the session rather than trusting the cookie like the
 * cheaper getSession() would). Several call sites across the app call this
 * independently in quick succession, so concurrent calls share one in-flight
 * request instead of each firing their own.
 */
export async function getCurrentUser() {
  if (!inFlightUser) {
    inFlightUser = fetchCurrentUser().finally(() => {
      inFlightUser = null;
    });
  }

  return inFlightUser;
}

/**
 * Discards any in-flight getCurrentUser() request. Called from
 * onAuthStateChange so a request that started before a sign-out/sign-in
 * transition can't be shared with callers that ask again after it -- they
 * get a fresh request reflecting the new session instead of a stale
 * in-flight one.
 */
export function invalidateCurrentUserCache() {
  inFlightUser = null;
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Error signing out:', error);
    throw error;
  }
}
