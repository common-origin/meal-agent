"use client";

import { useEffect, useState } from "react";
import { Box, Grid, GridCol, Sheet, Stack, tokens } from "@common-origin/design-system";
import Main from "@/components/app/Main";
import { countBySection } from "@/lib/admin/attention";
import type { DashboardData } from "@/lib/admin/queries";
import type { AdminLinks } from "@/lib/admin/links";
import { AdminNav, NAV_IDS } from "./AdminNav";
import { PageHeader } from "./PageHeader";
import { AiAgent, CostAndQuotas, Database, Errors, Households, Overview, Status, Tools, WeeklyCycleSection } from "./sections";
import { useMediaQuery } from "./useMediaQuery";

const DESKTOP_QUERY = `(min-width: ${tokens.base.breakpoint.lg})`;

/** Whether the screen is wide enough for the side navigation (see useMediaQuery for the server and no-matchMedia default). */
const useIsDesktop = (): boolean => useMediaQuery(DESKTOP_QUERY);

/** The section nearest the top of the screen, for marking it in the navigation. Null until one scrolls into view, and where IntersectionObserver is missing. */
function useActiveSection(ids: readonly string[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const visible = new Set<string>();
    const update = () =>
      setActive((previous) => {
        // At the end of the page the last, short sections can never reach the band: the one the hash
        // names (a nav or card click) if it's on screen, else the last section.
        const root = document.documentElement;
        if (root.scrollHeight > window.innerHeight && window.innerHeight + window.scrollY >= root.scrollHeight - 2) {
          const hash = decodeURIComponent(window.location.hash.slice(1));
          const target = ids.includes(hash) ? document.getElementById(hash) : null;
          return target && target.getBoundingClientRect().top < window.innerHeight ? hash : ids[ids.length - 1];
        }
        return ids.find((id) => visible.has(id)) ?? previous;
      });
    // The band between 10% and 40% down the screen: a section is "current" while it crosses it.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        update();
      },
      { rootMargin: "-10% 0px -60% 0px" }
    );
    for (const id of ids) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    // Reaching the end of the page changes no intersection, so check on scroll too (cheap: same value, no re-render).
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update);
    };
  }, [ids]);
  return active;
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
  const current = useActiveSection(NAV_IDS);
  // Widening the window swaps the Sheet for the sidebar: a Sheet left open must not come back when it narrows again.
  const [wasDesktop, setWasDesktop] = useState(desktop);
  if (desktop !== wasDesktop) {
    setWasDesktop(desktop);
    if (desktop) setNavOpen(false);
  }
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
                {/* Stops below the app's sticky header, as in-page jumps do (globals.css). */}
                {/* A rail taller than the screen scrolls on its own, so the last items stay reachable. */}
                <Box
                  data-testid="admin-nav-rail"
                  position="sticky"
                  px="xs"
                  top="calc(var(--app-header-height, 0px) + var(--co-semantic-space-400))"
                  maxHeight="calc(100vh - var(--app-header-height, 0px) - 2 * var(--co-semantic-space-400))"
                  overflowY="auto"
                >
                  <AdminNav counts={counts} current={current} />
                </Box>
              </GridCol>
            )}
            <GridCol span={12} spanLg={desktop ? 9 : 12}>
              <Stack direction="column" gap="lg">
                <Overview data={data} now={now} links={links} />
                <Status data={data.status} now={now} links={links} />
                <Errors data={data.errors} now={now} range={data.range} links={links} />
                <AiAgent data={data.ai} now={now} />
                <CostAndQuotas data={data.cost} />
                <Households data={data.households} range={data.range} selected={data.household} now={now} />
                <WeeklyCycleSection data={data.cycle} />
                <Database data={data.database} links={links} />
                <Tools links={links} />
              </Stack>
            </GridCol>
          </Grid>
        </Stack>
      </Box>
      {!desktop && (
        <Sheet isOpen={navOpen} onClose={() => setNavOpen(false)} position="left" title="Sections" width="20rem">
          <AdminNav
            counts={counts}
            current={current}
            onNavigate={(id) => {
              setNavOpen(false);
              // The Sheet's scroll lock lifts as it closes, which can undo the link's own jump: scroll again once it has.
              requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView?.());
            }}
          />
        </Sheet>
      )}
    </Main>
  );
}
