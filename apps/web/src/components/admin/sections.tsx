"use client";

/**
 * The /admin sections (#249), each taking the data the page loaded and
 * rendering it, or "couldn't load" when that section's query failed. No
 * names or emails anywhere: a household is its short ID.
 */

import Link from "next/link";
import { Alert, Stack, StatusLabel, Tag, Typography } from "@common-origin/design-system";
import type { AdminLinks } from "@/lib/admin/links";
import { ago, formatBytes, formatUsd, MIN_FOR_PERCENT, successPct, weekLabel } from "@/lib/admin/format";
import type {
  AiSummary,
  AttentionItem,
  CostData,
  DbStat,
  ErrorGroup,
  HouseholdRow,
  Loaded,
  Range,
  SchemaCheck,
  StatusData,
  WeeklyCycle,
} from "@/lib/admin/types";
import { Bar, DataTable, Empty, NotLoaded, Section, Stat, UptimeStrip, type Column } from "./ui";

const when = (iso: string) => iso.slice(0, 16).replace("T", " ") + " UTC";
const clock = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace("T", " ") + " UTC";

function minutes(ms: number): string {
  const total = Math.round(ms / 60_000);
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  return total % 60 === 0 ? `${hours} h` : `${hours} h ${total % 60} min`;
}

export function NeedsAttention({ data }: { data: Loaded<AttentionItem[]> }) {
  return (
    <Section id="attention" title="Needs attention" note="Worked out when this page loads, from the last 24 hours and 7 days across every household. Nothing is emailed.">
      {!data.ok ? (
        <NotLoaded hint={data.hint} />
      ) : data.data.length === 0 ? (
        <Empty>Nothing needs attention.</Empty>
      ) : (
        <Stack direction="column" gap="sm">
          {data.data.map((item) => (
            <Alert key={item.id} variant={item.severity === "error" ? "error" : "warning"}>
              {item.message} <a href={`#${item.section}`}>See {SECTION_NAMES[item.section]}</a>
            </Alert>
          ))}
        </Stack>
      )}
    </Section>
  );
}

const SECTION_NAMES: Record<AttentionItem["section"], string> = {
  status: "status",
  errors: "errors",
  ai: "the AI agent",
  cost: "cost and quotas",
  households: "households",
  database: "the database",
};

export function Status({ data }: { data: Loaded<StatusData> }) {
  return (
    <Section id="status" title="Status" note="From our own health checks, recorded every 15 minutes by the Uptime workflow.">
      {!data.ok ? (
        <NotLoaded hint={data.hint} />
      ) : (
        <StatusBody status={data.data} />
      )}
    </Section>
  );
}

function StatusBody({ status }: { status: StatusData }) {
  const { latest, uptime } = status;
  const incident = uptime.lastIncident;
  const checks = latest ? Object.entries(latest.checks ?? {}) : [];
  return (
    <Stack direction="column" gap="lg">
      {latest ? (
        <Stack direction="column" gap="sm">
          <Typography variant="small" color="subdued">
            Latest check {when(latest.created_at)}, {latest.total_latency_ms} ms in total.
          </Typography>
          <Stack direction="row" gap="md" wrap>
            {checks.map(([name, check]) => (
              <Stack key={name} direction="row" gap="xs" alignItems="center">
                <StatusLabel status={check.ok ? "completed" : "failed"} label={name} size="small" />
                {(check.detail || check.metrics) && (
                  <Typography variant="caption" color="subdued">
                    {[check.detail, check.metrics ? Object.entries(check.metrics).map(([k, v]) => `${k} ${v}`).join(", ") : null].filter(Boolean).join(" · ")}
                  </Typography>
                )}
              </Stack>
            ))}
          </Stack>
        </Stack>
      ) : (
        <Empty>No health check has been recorded yet.</Empty>
      )}

      <UptimeStrip slots={uptime.slots} />

      <Stack direction="row" gap="2xl" wrap>
        <Stat label="Uptime" value={uptime.uptimePct === null ? "–" : `${uptime.uptimePct.toFixed(2)}%`} note={`${uptime.okSlots} ok, ${uptime.failingSlots} failing`} />
        <Stat label="No data" value={`${Math.round(uptime.noDataShare * 100)}%`} note={`${uptime.noDataSlots} slots with no health check`} />
        <Stat label="Deployed release" value={status.deployedRelease} note={latest ? `Latest health row: ${latest.release}${latest.release === status.deployedRelease ? "" : " (differs)"}` : undefined} />
        <Stat
          label="Last incident"
          value={incident ? minutes(incident.end - incident.start) : "None"}
          note={incident ? `${clock(incident.start)} to ${clock(incident.end)}` : "In this range"}
        />
      </Stack>

      {uptime.possibleOutages.length > 0 && (
        <Stack direction="column" gap="xs">
          <Typography variant="label">Possible outages (no heartbeat)</Typography>
          {uptime.possibleOutages.map((run) => (
            <Typography key={run.start} variant="small">
              {clock(run.start)} to {clock(run.end)} ({minutes(run.end - run.start)})
            </Typography>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function errorWhere(group: ErrorGroup): string {
  return group.route ?? "no route";
}

export function Errors({ data, now }: { data: Loaded<ErrorGroup[]>; now: Date }) {
  return (
    <Section id="errors" title="Errors" note="Grouped by fingerprint. Messages are scrubbed of emails, URLs and ids; routes are patterns, never actual paths.">
      {!data.ok ? (
        <NotLoaded hint={data.hint} />
      ) : data.data.length === 0 ? (
        <Empty>No errors in this range.</Empty>
      ) : (
        <Stack direction="column" gap="sm">
          {data.data.map((group) => (
            <details key={group.fingerprint}>
              <summary style={{ cursor: "pointer" }}>
                <Typography variant="body" as="span">
                  <strong>{group.label ?? group.kind}</strong> · {group.count}× · last {ago(group.last_seen, now)}
                </Typography>
              </summary>
              <Stack direction="column" gap="sm">
                <Typography variant="small" color="subdued">
                  {group.message || "(no message)"}
                </Typography>
                <Stack direction="row" gap="sm" wrap>
                  <Tag size="small">{group.source}</Tag>
                  <Tag size="small">{errorWhere(group)}</Tag>
                  <Tag size="small">{`first seen ${when(group.first_seen)}`}</Tag>
                  <Tag size="small">{`releases ${group.releases.join(", ")}`}</Tag>
                  <Tag size="small">{`${group.households} household${group.households === 1 ? "" : "s"}`}</Tag>
                </Stack>
                <DataTable
                  caption={`Latest occurrences of ${group.label ?? group.kind}`}
                  rows={group.latest}
                  rowKey={(o) => `${o.created_at}-${o.release}-${o.digest ?? ""}`}
                  columns={[
                    { header: "When", render: (o) => when(o.created_at) },
                    { header: "Release", render: (o) => o.release },
                    { header: "Source", render: (o) => o.source },
                    { header: "Detail", align: "wrap", render: (o) => contextText(o.context, o.digest) },
                  ]}
                />
              </Stack>
            </details>
          ))}
        </Stack>
      )}
    </Section>
  );
}

function contextText(context: Record<string, unknown>, digest: string | null): string {
  const parts = Object.entries(context ?? {}).map(([key, value]) => `${key} ${String(value)}`);
  if (digest) parts.push(`digest ${digest}`);
  return parts.join(" · ") || "–";
}

export function AiAgent({ data }: { data: Loaded<AiSummary> }) {
  return (
    <Section id="ai" title="AI agent" note="Per task and model, for the range. Daily trend is by UTC day.">
      {!data.ok ? <NotLoaded hint={data.hint} /> : <AiBody ai={data.data} />}
    </Section>
  );
}

function AiBody({ ai }: { ai: AiSummary }) {
  const maxCalls = Math.max(1, ...ai.daily.map((day) => day.calls));
  if (ai.by_task.length === 0) return <Empty>No AI calls in this range.</Empty>;
  return (
    <Stack direction="column" gap="lg">
      <DataTable
        caption="AI calls per task and model"
        rows={ai.by_task}
        rowKey={(r) => `${r.task}-${r.model}`}
        columns={[
          { header: "Task", render: (r) => r.task },
          { header: "Model", render: (r) => r.model },
          { header: "Calls", align: "num", render: (r) => r.calls },
          { header: "Success", align: "num", render: (r) => (successPct(r.ok_calls, r.calls) ?? "–") + "%" },
          { header: "p50", align: "num", render: (r) => (r.p50_ms === null ? "–" : `${r.p50_ms} ms`) },
          { header: "p95", align: "num", render: (r) => (r.p95_ms === null ? "–" : `${r.p95_ms} ms`) },
          { header: "Avg tokens in/out", align: "num", render: (r) => `${r.avg_input_tokens ?? "–"} / ${r.avg_output_tokens ?? "–"}` },
          { header: "Cost", align: "num", render: (r) => formatUsd(Number(r.cost_usd)) },
          { header: "Statuses", render: (r) => Object.entries(r.statuses).map(([status, n]) => `${status} ${n}`).join(", ") },
          { header: "Top errors", render: (r) => r.top_errors.map((e) => `${e.code} ×${e.count}`).join(", ") || "–" },
        ]}
      />

      <Stack direction="column" gap="xs">
        <Typography variant="label">Calls per day</Typography>
        {ai.daily.map((day) => (
          <Stack key={day.day} direction="row" gap="md" alignItems="center">
            <Typography variant="small" as="span">
              {day.day}
            </Typography>
            <div style={{ flex: 1, maxWidth: 320 }}>
              <Bar value={day.calls} max={maxCalls} label={`${day.calls} calls, ${day.ok_calls} ok`} tone={day.ok_calls < day.calls ? "warning" : "default"} />
            </div>
            <Typography variant="small" color="subdued" as="span">
              {day.calls} calls, {day.ok_calls} ok, {formatUsd(Number(day.cost_usd))}
            </Typography>
          </Stack>
        ))}
      </Stack>

      <Stack direction="column" gap="xs">
        <Typography variant="label">Latest failures</Typography>
        {ai.failures.length === 0 ? (
          <Empty>No failed calls in this range.</Empty>
        ) : (
          <DataTable
            caption="Latest failed AI calls"
            rows={ai.failures}
            rowKey={(f) => `${f.created_at}-${f.task}-${f.model}-${f.status}-${f.error_code ?? ''}-${f.latency_ms}`}
            columns={[
              { header: "When", render: (f) => when(f.created_at) },
              { header: "Task", render: (f) => f.task },
              { header: "Model", render: (f) => f.model },
              { header: "Status", render: (f) => f.status },
              { header: "Code", render: (f) => f.error_code ?? "–" },
              { header: "Latency", align: "num", render: (f) => `${f.latency_ms} ms` },
            ]}
          />
        )}
      </Stack>
    </Stack>
  );
}

export function CostAndQuotas({ data }: { data: Loaded<CostData> }) {
  return (
    <Section id="cost" title="Cost and quotas">
      {!data.ok ? <NotLoaded hint={data.hint} /> : <CostBody cost={data.data} />}
    </Section>
  );
}

function CostBody({ cost }: { cost: CostData }) {
  const spendPct = cost.capUsd > 0 ? (cost.spendTodayUsd / cost.capUsd) * 100 : 0;
  return (
    <Stack direction="column" gap="lg">
      <Stack direction="row" gap="2xl" wrap>
        <Stack direction="column" gap="xs">
          <Stat label="AI spend today (UTC)" value={`${formatUsd(cost.spendTodayUsd)} of ${formatUsd(cost.capUsd)}`} note={`${Math.round(spendPct)}% of the daily cap`} />
          <Bar value={cost.spendTodayUsd} max={cost.capUsd} label={`${Math.round(spendPct)}% of the daily AI spend cap`} tone={spendPct >= 100 ? "danger" : spendPct >= 80 ? "warning" : "default"} />
        </Stack>
        <Stat label="Month to date" value={formatUsd(cost.monthToDateUsd)} note={`Day ${cost.daysElapsed.toFixed(1)} of ${cost.daysInMonth}`} />
        <Stat label="Projected month end" value={formatUsd(cost.projectedMonthUsd)} note="Naive: month to date scaled by days elapsed" />
      </Stack>
      {cost.coles ? (
        <Stack direction="column" gap="xs">
          <Stat label={`Coles lookups, ${cost.coles.month}`} value={`${cost.coles.used} of ${cost.coles.limit}`} note={`${cost.coles.remaining} remaining`} />
          <Bar
            value={cost.coles.used}
            max={cost.coles.limit}
            label={`${cost.coles.used} of ${cost.coles.limit} Coles lookups used`}
            tone={cost.coles.used >= cost.coles.limit ? "danger" : cost.coles.used / cost.coles.limit >= 0.8 ? "warning" : "default"}
          />
        </Stack>
      ) : (
        <NotLoaded hint="is migration 018 applied?" />
      )}
    </Stack>
  );
}

export function Households({ data, range, selected, now }: { data: Loaded<HouseholdRow[]>; range: Range; selected: string | null; now: Date }) {
  const href = (shortId: string) => `/admin?range=${range}&household=${shortId}#households`;
  const columns: Column<HouseholdRow>[] = [
    {
      header: "Household",
      render: (h) => (
        <Link href={h.shortId === selected ? `/admin?range=${range}#households` : href(h.shortId)} aria-label={`Filter the page to household ${h.shortId}`}>
          {h.shortId}
        </Link>
      ),
    },
    { header: "Members", align: "num", render: (h) => h.members },
    { header: "Pending invites", align: "num", render: (h) => h.pending_invites },
    { header: "Last active", render: (h) => ago(h.last_active, now) },
    { header: "This week's plan", render: (h) => (h.has_plan_this_week ? "yes" : "no") },
    { header: "Settings complete", render: (h) => (h.settings_complete ? "yes" : "no") },
    { header: "AI calls", align: "num", render: (h) => h.ai_calls },
    { header: "AI cost", align: "num", render: (h) => formatUsd(Number(h.ai_cost_usd)) },
    { header: "Errors", align: "num", render: (h) => h.errors },
  ];
  return (
    <Section id="households" title="Households" note="Short IDs only: no names or emails. Select one to filter the errors, AI and weekly cycle sections; select it again to clear.">
      {!data.ok ? (
        <NotLoaded hint={data.hint} />
      ) : data.data.length === 0 ? (
        <Empty>No households yet.</Empty>
      ) : (
        <DataTable caption="Households" columns={columns} rows={data.data} rowKey={(h) => h.shortId} selected={(h) => h.shortId === selected} />
      )}
    </Section>
  );
}

const FUNNEL: { type: string; header: string }[] = [
  { type: "plan_confirmed", header: "Confirmed" },
  { type: "shopping_list_built", header: "List built" },
  { type: "coles_list_sent", header: "Sent to Coles" },
  { type: "shopping_completed", header: "Shopping done" },
];

/** A household count: just the count under 10 composed plans, else the count and its share of them. */
function funnelCell(count: number, composed: number): string {
  if (composed < MIN_FOR_PERCENT) return String(count);
  return `${count} (${Math.round((count / composed) * 100)}%)`;
}

export function WeeklyCycleSection({ data }: { data: Loaded<WeeklyCycle> }) {
  return (
    <Section
      id="cycle"
      title="Weekly cycle and usage"
      note="The last 8 ISO weeks (Monday start, each in the household's own time zone, Australia/Sydney when unset). Steps are joined on the planned week, not the week of the click. Under 10 plans a week shows counts, not percentages."
    >
      {!data.ok ? <NotLoaded hint={data.hint} /> : <CycleBody cycle={data.data} />}
    </Section>
  );
}

function CycleBody({ cycle }: { cycle: WeeklyCycle }) {
  const { events } = cycle;
  const at = (week: string, type: string) => events.funnel.find((f) => f.week_start === week && f.type === type)?.households ?? 0;
  const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
  const composedTotal = cycle.weeks.reduce((n, w) => n + w.composed, 0);
  const manual = sum(events.swaps) + sum(events.edits);
  const bySource = (key: "recipes_ai" | "recipes_imported" | "recipes_user_added") => cycle.weeks.reduce((n, w) => n + w[key], 0);
  const countsSorted = Object.entries(events.counts).sort((a, b) => b[1] - a[1]);

  return (
    <Stack direction="column" gap="lg">
      <Typography variant="small" color="subdued">
        Households with a plan are counted from meal plans; the other steps come from anonymous product events{events.available ? "" : " (migration 020 isn't applied, so they show 0)"}. {cycle.households_total} household{cycle.households_total === 1 ? "" : "s"} in total.
      </Typography>
      <DataTable
        caption="Households at each step of the weekly cycle, per planned week"
        rows={cycle.weeks}
        rowKey={(w) => w.week_start}
        columns={[
          { header: "Week of", render: (w) => weekLabel(w.week_start) },
          { header: "Composed", align: "num", render: (w) => w.composed },
          ...FUNNEL.map<Column<WeeklyCycle["weeks"][number]>>(({ type, header }) => ({
            header,
            align: "num",
            render: (w) => funnelCell(at(w.week_start, type), w.composed),
          })),
        ]}
      />

      <Stack direction="row" gap="2xl" wrap>
        <Stat label="Manual effort" value={composedTotal > 0 ? (manual / composedTotal).toFixed(1) : "–"} note={`${sum(events.swaps)} swaps and deletes + ${sum(events.edits)} accepted edits, per composed plan`} />
        <Stat label="Recipes added" value={`${bySource("recipes_ai")} AI / ${bySource("recipes_imported")} imported / ${bySource("recipes_user_added")} user-added`} note="Photo and manual entry can't be told apart, so both are user-added" />
        <Stat label="Cuisines cooked per household" value={cycle.cuisines.avg === null ? "–" : String(cycle.cuisines.avg)} note={cycle.cuisines.households > 0 ? `${cycle.cuisines.households} households, up to ${cycle.cuisines.max}` : "No cooked history yet"} />
        <Stat label="Ratings given" value={events.ratings.count} note={events.ratings.avg === null ? undefined : `Average ${events.ratings.avg} stars`} />
      </Stack>

      <Stack direction="column" gap="xs">
        <Typography variant="label">Events by type</Typography>
        {countsSorted.length === 0 ? (
          <Empty>No events in these weeks.</Empty>
        ) : (
          <Stack direction="row" gap="sm" wrap>
            {countsSorted.map(([type, n]) => (
              <Tag key={type} size="small">{`${type} ${n}`}</Tag>
            ))}
          </Stack>
        )}
      </Stack>
    </Stack>
  );
}

export function Database({ data, links }: { data: Loaded<{ stats: DbStat[]; schema: SchemaCheck[] }>; links: AdminLinks }) {
  return (
    <Section id="database" title="Database" note="Row counts are the database's own estimates. Dead tuples above 20% suggest a vacuum is behind.">
      {!data.ok ? (
        <NotLoaded hint={data.hint} />
      ) : (
        <Stack direction="column" gap="lg">
          <Stack direction="column" gap="xs">
            <Typography variant="label">Migrations (009 on; earlier ones are assumed applied)</Typography>
            <Stack direction="row" gap="sm" wrap>
              {data.data.schema.map((check) => (
                <StatusLabel key={check.migration} status={check.applied ? "completed" : "failed"} label={`${check.migration} ${check.applied ? "applied" : "MISSING"}`} size="small" />
              ))}
            </Stack>
          </Stack>
          <DataTable
            caption="Tables"
            rows={data.data.stats}
            rowKey={(s) => s.table}
            columns={[
              { header: "Table", render: (s) => s.table },
              { header: "Rows", align: "num", render: (s) => s.rows.toLocaleString("en-AU") },
              { header: "Size", align: "num", render: (s) => formatBytes(s.size_bytes) },
              { header: "Dead tuples", align: "num", render: (s) => `${(s.dead_ratio * 100).toFixed(1)}%` },
              { header: "", render: (s) => (s.dead_ratio > 0.2 ? <Tag size="small" variant="emphasis">High dead tuples</Tag> : null) },
            ]}
          />
          <Stack direction="row" gap="lg" wrap>
            {links.supabase.map((link) => (
              <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
                Supabase: {link.label}
              </a>
            ))}
            {links.vercel.map((link) => (
              <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            ))}
          </Stack>
        </Stack>
      )}
    </Section>
  );
}

export function DebugLinks({ links: { debug } }: { links: AdminLinks }) {
  return (
    <Section id="debug" title="Debug pages">
      <Stack direction="row" gap="lg" wrap>
        {debug.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
      </Stack>
    </Section>
  );
}
