"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Stack, Typography, Button, ResponsiveGrid, Box } from "@common-origin/design-system";
import { track } from "@/lib/analytics";
import { useAuth } from "@/components/auth/AuthProvider";

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    track('page_view', { page: '/' });
  }, []);

  useEffect(() => {
    // Redirect an already-authenticated visitor to the meal plan
    if (!loading && user) {
      router.push('/plan');
    }
  }, [loading, user, router]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        paddingBottom: "64px",
      }}
    >
      <Stack direction="column" gap="2xl">
        <Box
          maxWidth="600px"
          bg="surface.raised"
          borderRadius="lg"
          p="7xl"
          shadow="raised"
          style={{ textAlign: "center" }}
        >
          <Stack direction="column" gap="lg">
            <Typography variant="h1">Meal Agent</Typography>
            <Typography>Plan your week, get a shopping list, and order—all in one place.</Typography>
            
            <div style={{ display: "flex", gap: "16px", justifyContent: "center", marginTop: "24px" }}>
              <Link href="/signup" style={{ textDecoration: "none" }}>
                <Button variant="primary" size="large">
                  Get started
                </Button>
              </Link>
              <Link href="/login" style={{ textDecoration: "none" }}>
                <Button variant="secondary" size="large">
                  Sign in
                </Button>
              </Link>
            </div>
          </Stack>
        </Box>
        <div style={{ maxWidth: "600px", margin: "0 auto", textAlign: "center" }} >
          <ResponsiveGrid cols={1} colsSm={3}>
            <Box borderRight="input-hover" p="lg">
              <Typography variant="body" color="subdued">
                AI-powered meal plans tailored to your family
              </Typography>
            </Box>
            <Box borderRight="input-hover" p="lg">
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
