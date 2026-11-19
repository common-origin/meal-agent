"use client";

import { useState, useSyncExternalStore } from "react";
import { Box, Grid, GridCol, Sheet, Stack, tokens } from "@common-origin/design-system";
import Main from "@/components/app/Main";
import { countBySection } from "@/lib/admin/attention";
import type { DashboardData } from "@/lib/admin/queries";
import type { AdminLinks } from "@/lib/admin/links";
import { AdminNav } from "./AdminNav";
import { PageHeader } from "./PageHeader";
import { AiAgent, CostAndQuotas, Database, DebugLinks, Errors, Households, Overview, Status, WeeklyCycleSection } from "./sections";

const DESKTOP_QUERY = `(min-width: ${tokens.base.breakpoint.lg})`;

/** Whether the screen is wide enough for the side navigation. True on the server and where matchMedia is missing; the browser corrects it after hydrating. */
function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const query = window.matchMedia(DESKTOP_QUERY);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => (typeof window.matchMedia === "function" ? window.matchMedia(DESKTOP_QUERY).matches : true),
    () => true
  );
}

/**
 * The /admin overview (#249). The page loads everything on the server and
 * passes it here already serialisable (`links` too: it reads env vars the
 * browser doesn't have, so it can't be built here, #272); each section shows its own data or its
 * own "couldn't load". Laid out like a product console (#282): a header with
 * the range and Refresh, navigation down the side (in a Sheet on a phone),
 * and each section on its own surface, all at compact density. On a phone
 * the stats grid drops to two columns and rows wrap.
 */
export default function AdminDashboard({ data, links }: { data: DashboardData; links: AdminLinks }) {
  const desktop = useIsDesktop();
  const [navOpen, setNavOpen] = useState(false);
  const now = new Date(data.generatedAt);
  const counts = data.attention.ok ? countBySection(data.attention.data) : null;
  return (
    <Main maxWidth="xl">
      <Box data-co-density="compact">
        <Stack direction="column" gap="lg">
          <PageHeader range={data.range} household={data.household} generatedAt={data.generatedAt} menu={desktop ? undefined : { onOpen: () => setNavOpen(true) }} />
          <Grid cols={12} gap="6">
            {desktop && (
              <GridCol span={12} spanLg={3}>
                <Box position="sticky" top="16px">
                  <AdminNav counts={counts} />
                </Box>
              </GridCol>
            )}
            <GridCol span={12} spanLg={desktop ? 9 : 12}>
              <Stack direction="column" gap="lg">
                <Overview data={data} now={now} links={links} />
                <Status data={data.status} now={now} links={links} />
                <Errors data={data.errors} now={now} range={data.range} links={links} />
                <AiAgent data={data.ai} />
                <CostAndQuotas data={data.cost} />
                <Households data={data.households} range={data.range} selected={data.household} now={now} />
                <WeeklyCycleSection data={data.cycle} />
                <Database data={data.database} links={links} />
                <DebugLinks links={links} />
              </Stack>
            </GridCol>
          </Grid>
        </Stack>
      </Box>
      {!desktop && (
        <Sheet isOpen={navOpen} onClose={() => setNavOpen(false)} position="left" title="Sections" width="20rem">
          <AdminNav counts={counts} onNavigate={() => setNavOpen(false)} />
        </Sheet>
      )}
    </Main>
  );
}
