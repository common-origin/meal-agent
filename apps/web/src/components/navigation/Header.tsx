"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Stack, Typography, Button, Box } from "@common-origin/design-system";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

const NAV_ITEMS = [
  { href: '/plan', label: 'Plan' },
  { href: '/shopping-list', label: 'Shopping' },
  { href: '/recipes', label: 'Recipes' },
  { href: '/settings', label: 'Settings' },
];

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
    <Box
      as="header"
      borderBottom="default"
      p="lg"
      bg="default"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap="lg">
        {/* Logo/Brand */}
        <Link href="/" style={{ textDecoration: "none" }}>
          <Typography variant="h3">Meal Agent</Typography>
        </Link>

        {/* Navigation Links */}
        <Stack direction="row" gap="sm" alignItems="center">
          {NAV_ITEMS.map(({ href, label }) => (
            <Link key={href} href={href} style={{ textDecoration: 'none' }}>
              <Button
                variant="naked"
                size="medium"
                style={pathname === href ? { fontWeight: 600, backgroundColor: 'rgba(0,0,0,0.05)' } : undefined}
              >
                {label}
              </Button>
            </Link>
          ))}
          
          {user && (
            <Button
              variant="naked"
              size="medium"
              onClick={handleSignOut}
              disabled={loading}
            >
              {loading ? 'Signing out...' : 'Sign out'}
            </Button>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}
