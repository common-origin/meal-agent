"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Stack, TabBar, Typography } from "@common-origin/design-system";
import Main from "@/components/app/Main";
import { RANGES } from "@/lib/admin/format";
import type { DashboardData } from "@/lib/admin/queries";
import { AiAgent, CostAndQuotas, Database, DebugLinks, Errors, Households, Overview, Status, WeeklyCycleSection } from "./sections";

const JUMPS: [string, string][] = [
  ["status", "Status"],
  ["errors", "Errors"],
  ["ai", "AI agent"],
  ["cost", "Cost"],
  ["households", "Households"],
  ["cycle", "Usage"],
  ["database", "Database"],
];

/**
 * The /admin overview (#249). The page loads everything on the server and
 * passes it here already serialisable; each section shows its own data or its
 * own "couldn't load". Mobile-friendly: tables scroll sideways inside their
 * section and the stats wrap.
 */
export default function AdminDashboard({ data }: { data: DashboardData }) {
  const router = useRouter();
  const now = new Date(data.generatedAt);
  const query = (range: string) => `/admin?range=${range}${data.household ? `&household=${data.household}` : ""}`;
  return (
    <Main maxWidth="xl">
      <Stack direction="column" gap="2xl">
        <Stack direction="column" gap="sm">
          <Typography variant="h1">Admin</Typography>
          <TabBar
            aria-label="Time range"
            tabs={RANGES.map((range) => ({ id: range, label: range === "24h" ? "24 hours" : range === "7d" ? "7 days" : "30 days" }))}
            activeTab={data.range}
            onTabChange={(range) => router.push(query(range))}
          />
          {data.household && (
            <Typography variant="small">
              Household {data.household} · <Link href={`/admin?range=${data.range}`}>clear filter</Link>
            </Typography>
          )}
          <Typography variant="small" color="subdued">
            Loaded {data.generatedAt.slice(0, 16).replace("T", " ")} UTC. Reload for fresh numbers.
          </Typography>
          <nav aria-label="Jump to a section">
            <Stack direction="row" gap="md" wrap>
              {JUMPS.map(([id, label]) => (
                <a key={id} href={`#${id}`}>
                  {label}
                </a>
              ))}
            </Stack>
          </nav>
        </Stack>

        <Overview data={data} now={now} />
        <Status data={data.status} now={now} />
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
