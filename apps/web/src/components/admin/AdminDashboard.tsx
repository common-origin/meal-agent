"use client";

import Link from "next/link";
import { Stack, Typography } from "@common-origin/design-system";
import Main from "@/components/app/Main";
import { RANGES } from "@/lib/admin/format";
import type { DashboardData } from "@/lib/admin/queries";
import { AiAgent, CostAndQuotas, Database, DebugLinks, Errors, Households, NeedsAttention, Status, WeeklyCycleSection } from "./sections";

/**
 * The /admin overview (#249). The page loads everything on the server and
 * passes it here already serialisable; each section shows its own data or its
 * own "couldn't load". Mobile-friendly: tables scroll sideways inside their
 * section and the stats wrap.
 */
export default function AdminDashboard({ data }: { data: DashboardData }) {
  const now = new Date(data.generatedAt);
  const query = (range: string) => `/admin?range=${range}${data.household ? `&household=${data.household}` : ""}`;
  return (
    <Main maxWidth="xl">
      <Stack direction="column" gap="2xl">
        <Stack direction="column" gap="sm">
          <Typography variant="h1">Admin</Typography>
          <Stack direction="row" gap="md" alignItems="center" wrap>
            <Typography variant="small" color="subdued" as="span">
              Range:
            </Typography>
            {RANGES.map((range) => (
              <Link key={range} href={query(range)} aria-current={range === data.range ? "true" : undefined} style={{ fontWeight: range === data.range ? 700 : 400 }}>
                {range}
              </Link>
            ))}
            {data.household && (
              <Typography variant="small" as="span">
                Household {data.household} · <Link href={`/admin?range=${data.range}`}>clear filter</Link>
              </Typography>
            )}
          </Stack>
          <Typography variant="caption" color="subdued">
            Loaded {data.generatedAt.slice(0, 16).replace("T", " ")} UTC. Reload for fresh numbers.
          </Typography>
        </Stack>

        <NeedsAttention data={data.attention} />
        <Status data={data.status} />
        <Errors data={data.errors} now={now} />
        <AiAgent data={data.ai} />
        <CostAndQuotas data={data.cost} />
        <Households data={data.households} range={data.range} selected={data.household} now={now} />
        <WeeklyCycleSection data={data.cycle} />
        <Database data={data.database} />
        <DebugLinks />
      </Stack>
    </Main>
  );
}
