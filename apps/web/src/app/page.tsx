"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Stack, Typography, Button } from "@common-origin/design-system";
import { track } from "@/lib/analytics";

export default function HomePage() {
  useEffect(() => {
    track('page_view', { page: '/' });
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
      }}
    >
      <div
        style={{
          maxWidth: "600px",
          textAlign: "center",
          backgroundColor: "#fff",
          padding: "48px",
          borderRadius: "16px",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        }}
      >
        <Stack direction="column" gap="lg">
          <div>
            <div style={{ fontSize: "64px", marginBottom: "16px" }}>🍽️</div>
            <Typography variant="h1">Meal Agent</Typography>
          </div>
          
          <Typography variant="body">
            Plan dinners for your family and export a shopping list ready for Coles.
          </Typography>
          
          <div style={{ display: "flex", gap: "16px", justifyContent: "center", marginTop: "16px" }}>
            <Link href="/onboarding" style={{ textDecoration: "none" }}>
              <Button variant="primary" size="large">
                Start Planning
              </Button>
            </Link>
            <Link href="/plan" style={{ textDecoration: "none" }}>
              <Button variant="secondary" size="large">
                Try Sample Week
              </Button>
            </Link>
          </div>
        </Stack>
      </div>
    </main>
  );
}
