"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Box, Stack, Typography, Button } from "@common-origin/design-system";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  isActive: boolean;
}

function NavLink({ href, children, isActive }: NavLinkProps) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        padding: "8px 16px",
        borderRadius: "8px",
        backgroundColor: isActive ? "rgba(0, 0, 0, 0.05)" : "transparent",
        transition: "background-color 0.2s",
      }}
    >
      <div
        style={{
          fontWeight: isActive ? 600 : 400,
          color: isActive ? "#000" : "#666",
        }}
      >
        <Typography variant="body">{children}</Typography>
      </div>
    </Link>
  );
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    
    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Don't show header on landing, login, or signup pages
  if (pathname === "/" || pathname === "/login" || pathname === "/signup") {
    return null;
  }

  return (
    <header
      style={{
        borderBottom: "1px solid #e0e0e0",
        padding: "16px 24px",
        backgroundColor: "#fff",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
        }}
      >
        {/* Logo/Brand */}
        <Link href="/" style={{ textDecoration: "none" }}>
          <div style={{ margin: 0 }}>
            <Typography variant="h3">🍽️ Meal Agent</Typography>
          </div>
        </Link>

        {/* Navigation Links */}
        <Box style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <NavLink href="/plan" isActive={pathname === "/plan"}>
            Plan
          </NavLink>
          <NavLink href="/shopping-list" isActive={pathname === "/shopping-list"}>
            Shopping
          </NavLink>
          <NavLink href="/recipes" isActive={pathname === "/recipes"}>
            Recipes
          </NavLink>
          <NavLink href="/settings" isActive={pathname === "/settings"}>
            Settings
          </NavLink>
          
          {user && (
            <Button
              variant="secondary"
              size="large"
              onClick={handleSignOut}
              disabled={loading}
            >
              {loading ? 'Signing out...' : 'Sign out'}
            </Button>
          )}
        </Box>
      </div>
    </header>
  );
}
