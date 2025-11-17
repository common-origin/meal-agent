"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Stack, Typography, Button, ResponsiveGrid, Box } from "@common-origin/design-system";
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
        paddingBottom: "64px",
        background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
      }}
    >
      <Stack direction="column" gap="2xl">
        <Box
          maxWidth="600px"
          bg="subtle"
          borderRadius="4"
          p="7xl"
          style={{
            textAlign: "center",
            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
          }}
        >
          <Stack direction="column" gap="lg">
            <Typography variant="h1">Meal Agent</Typography>
            <Typography>Plan your week, get a shopping list, and order—all in one place.</Typography>
            
            <div style={{ display: "flex", gap: "16px", justifyContent: "center", marginTop: "24px" }}>
              <Link href="/plan" style={{ textDecoration: "none" }}>
                <Button variant="primary" size="large">
                  Plan your week
                </Button>
              </Link>
              <Link href="/about" style={{ textDecoration: "none" }}>
                <Button variant="secondary" size="large">
                  Learn more
                </Button>
              </Link>
            </div>
          </Stack>
        </Box>
        <div style={{ maxWidth: "600px", margin: "0 auto", textAlign: "center" }} >
          <ResponsiveGrid cols={1} colsSm={3} gapX="lg" gapY="lg" gap="lg">
            <Box borderRight="strong" p="lg">
              <Typography variant="body" color="subdued">
                AI-powered meal plans tailored to your family
              </Typography>
            </Box>
            <Box borderRight="strong" p="lg">
              <Typography variant="body" color="subdued">
                Auto-calculated shopping lists with exact quantities
              </Typography>
            </Box>
            <Box p="lg">
              <Typography variant="body" color="subdued">
                Order directly from your supermarket
              </Typography>
            </Box>
          </ResponsiveGrid>
        </div>
      </Stack>
    </main>
  );
}
