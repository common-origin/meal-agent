"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient, getCurrentUser, invalidateCurrentUserCache } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

/**
 * Fetches the current user once (via the server-verified getUser(), not the
 * unverified getSession()) and keeps it in sync via onAuthStateChange, so
 * client components share a single auth check instead of each calling
 * supabase.auth.getUser() independently.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    getCurrentUser()
      .then((user) => {
        setUser(user);
      })
      .catch(() => {
        // getCurrentUser() itself already swallows a Supabase auth error
        // into `null` -- this only guards against something upstream
        // (e.g. createClient() throwing on missing env vars) rejecting
        // instead, so loading can't get stuck true forever.
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // A request kicked off by getCurrentUser() before this transition
      // could still be in flight; discard it so a caller asking again
      // after this point gets a fresh request instead of that stale one.
      invalidateCurrentUserCache();
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
