"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Stack, Typography } from "@common-origin/design-system";

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

  // Don't show header on landing page
  if (pathname === "/") {
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
        <Stack direction="row" gap="sm">
          <NavLink href="/plan" isActive={pathname === "/plan"}>
            Plan
          </NavLink>
          <NavLink href="/recipes" isActive={pathname === "/recipes"}>
            My Recipes
          </NavLink>
          <NavLink href="/recipes/add" isActive={pathname === "/recipes/add"}>
            Add Recipe
          </NavLink>
          <NavLink href="/shopping-list" isActive={pathname === "/shopping-list"}>
            Shopping List
          </NavLink>
          <NavLink href="/settings" isActive={pathname === "/settings"}>
            Settings
          </NavLink>
        </Stack>
      </div>
    </header>
  );
}
