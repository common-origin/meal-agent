"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Stack, Typography, Button, Box, tokens } from "@common-origin/design-system";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useGenerationActivity } from "@/components/generation/GenerationActivityProvider";
import { clearHouseholdScopedCaches } from "@/lib/storage";

const HEADER_ID = "app-header";
const HEADER_HEIGHT_VAR = "--app-header-height";

const NAV_ITEMS = [
  { href: '/plan', label: 'Plan' },
  { href: '/shopping-list', label: 'Shopping' },
  { href: '/recipes', label: 'Recipes' },
  { href: '/settings', label: 'Settings' },
];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { isGenerationInProgress, beginSignOut, endSignOut } = useGenerationActivity();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    // Marked before the signOut() await starts (not just via the disabled
    // button below), so a generation/save that's clicked during that await
    // gets refused instead of racing clearHouseholdScopedCaches() below.
    beginSignOut();

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('Failed to sign out:', error);
        return;
      }

      clearHouseholdScopedCaches();
      router.push('/login');
    } catch (err) {
      // supabase.auth.signOut() can reject outright (e.g. a network
      // exception), not just resolve with { error } -- without this catch,
      // beginSignOut() above would never be undone, permanently disabling
      // sign-out and every generation/save entry point for the rest of
      // the browser session.
      console.error('Failed to sign out:', err);
    } finally {
      setSigningOut(false);
      endSignOut();
    }
  };

  // Don't show header on landing, login, or signup pages
  const hidden = pathname === "/" || pathname === "/login" || pathname === "/signup";

  // The header is sticky, so it would cover whatever an in-page link jumps to. Its height goes in
  // --app-header-height, which globals.css adds to the page's scroll-padding-top (and sticky parts
  // such as /admin's side navigation use to stop below it). Kept current as the header wraps.
  useEffect(() => {
    const root = document.documentElement;
    const header = document.getElementById(HEADER_ID);
    if (hidden || !header) return;
    const publish = () => root.style.setProperty(HEADER_HEIGHT_VAR, `${header.offsetHeight}px`);
    publish();
    // A page opened at #id was scrolled there before this ran, with no room for the header: scroll again now there is.
    if (window.location.hash) document.getElementById(decodeURIComponent(window.location.hash.slice(1)))?.scrollIntoView();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(publish);
    observer?.observe(header);
    return () => {
      observer?.disconnect();
      root.style.removeProperty(HEADER_HEIGHT_VAR);
    };
  }, [hidden]);

  if (hidden) {
    return null;
  }

  return (
    <Box
      as="header"
      id={HEADER_ID}
      borderBottom="default"
      p="lg"
      bg="surface.base"
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
                style={pathname === href ? { fontWeight: 600, backgroundColor: tokens.semantic.color.fill.muted } : undefined}
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
              disabled={signingOut || isGenerationInProgress}
            >
              {signingOut
                ? 'Signing out...'
                : isGenerationInProgress
                  ? 'Please wait…'
                  : 'Sign out'}
            </Button>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}
