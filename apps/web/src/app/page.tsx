"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Stack, Typography } from "@common-origin/design-system";
import { track } from "@/lib/analytics";

export default function HomePage() {
  useEffect(() => {
    track('page_view', { page: '/' });
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <Stack direction="column" gap="lg">
        <Typography variant="h1">Meal Agent</Typography>
        <Typography variant="body">
          Plan dinners for your family and export a shopping list ready for Coles.
        </Typography>
        <Stack direction="row" gap="md">
          <Link href="/onboarding">
            <Typography variant="body">
              Start planning
            </Typography>
          </Link>
          <Link href="/plan">
            <Typography variant="body">
              Try sample week
            </Typography>
          </Link>
        </Stack>
      </Stack>
    </main>
  );
}
