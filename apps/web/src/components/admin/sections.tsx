"use client";

/**
 * The /admin sections (#249, #270), each taking the data the page loaded and
 * rendering it, or "couldn't load" when that section's query failed. Built from
 * design-system parts only (see ./ui). No names or emails anywhere: a household
 * is its short ID.
 */

import Link from "next/link";
import { Button, List, ListItem, ResponsiveGrid, Stack, Tag, Typography } from "@common-origin/design-system";
import { attentionWhen } from "@/lib/admin/attention";
import { errorInvestigateLinks, prioritiseErrors } from "@/lib/admin/errors";
import { resolveAction, type AdminLinks, type ResolvedAction } from "@/lib/admin/links";
import { ago, ERROR_GROUP_LIMIT, formatBytes, formatDuration, formatUsd, hasManyDeadTuples, MIN_FOR_PERCENT, plural, successPct, utcStamp, weekLabel } from "@/lib/admin/format";
import { computeHeadline } from "@/lib/admin/headline";
import { aiProblems, cycleSentence, databaseSummary } from "@/lib/admin/summaries";
import type { DashboardData } from "@/lib/admin/queries";
import type { AiSummary, AttentionItem, CostData, DbStat, ErrorGroup, HouseholdRow, Loaded, Range, SchemaCheck, StatusData, WeeklyCycle } from "@/lib/admin/types";
import { Bar, Disclosure, Empty, ExpandableItem, Field, NotLoaded, Section, SeverityLabel, Stat, Stats, Tile, UptimeStrip } from "./ui";

const when = utcStamp;
const dot = (parts: (string | null | false | undefined)[]) => parts.filter(Boolean).join(" · ");

/** Link-styled design-system buttons, in a row: an action or an "investigate" link. External ones open in a new tab. */
function LinkButtons({ links }: { links: ResolvedAction[] }) {
  return (
    <Stack direction="row" gap="sm" wrap>
      {links.map((link) => (
        <Button key={`${link.label}-${link.href}`} purpose="link" variant="secondary" size="small" url={link.href} {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}>
          {link.label}
        </Button>
      ))}
    </Stack>
  );
}

/** Each thing to look at: severity, a short title, where and since when; open one for how to fix it and where to click. */
function Inbox({ items, links, now }: { items: AttentionItem[]; links: AdminLinks; now: Date }) {
  return (
    <List>
      {items.map((item) => (
        <ExpandableItem key={item.id} primary={item.title} secondary={dot([item.where, attentionWhen(item, now)])} badge={<SeverityLabel level={item.severity} />}>
          <Stack direction="column" gap="md">
            <Typography variant="body">{item.message}</Typography>
            <Stack direction="column" gap="xs">
              <Typography variant="label">How to fix</Typography>
              {item.fix.map((step, i) => (
                <Typography key={step} variant="body">{`${i + 1}. ${step}`}</Typography>
              ))}
            </Stack>
            <LinkButtons links={item.actions.map((action) => resolveAction(action, item.section, links)).filter((link): link is ResolvedAction => link !== null)} />
          </Stack>
        </ExpandableItem>
      ))}
    </List>
  );
}

/**
 * The top of the page: one sentence on whether anything needs attention, the
 * triage inbox of each thing to look at, then four headline numbers that link
 * to their sections.
 */
export function Overview({ data, now, links }: { data: DashboardData; now: Date; links: AdminLinks }) {
  const headline = computeHeadline(data, now);
  return (
    <Section
      id="overview"
      title={headline.title}
      note="The inbox, status and spend cover everything. Errors and active households follow the range."
      detail="Worked out each time the page loads from the last 24 hours and 7 days, whatever range or household the page is filtered to. Nothing is emailed: this page is where problems show."
    >
      {!data.attention.ok ? <NotLoaded hint={data.attention.hint} /> : data.attention.data.length > 0 && <Inbox items={data.attention.data} links={links} now={now} />}
      <ResponsiveGrid cols={2} colsMd={4} gapX="4" gapY="4">
        {headline.tiles.map((tile) => (
          <Tile key={tile.id} label={tile.label} value={tile.value} note={tile.note} tone={tile.tone} href={tile.href} />
        ))}
      </ResponsiveGrid>
    </Section>
  );
}

export function Status({ data, now, links }: { data: Loaded<StatusData>; now: Date; links: AdminLinks }) {
  return (
    <Section
      id="status"
      title="Status"
      note="Is the app up? Checked every 15 minutes."
      detail="Our own health check calls the app and its services every 15 minutes (a scheduled GitHub Actions run) and stores the result. Nothing is emailed."
      actions={<LinkButtons links={[{ label: "Uptime workflow", href: links.targets.uptimeWorkflow, external: true }]} />}
    >
      {!data.ok ? <NotLoaded hint={data.hint} /> : <StatusBody status={data.data} now={now} />}
    </Section>
  );
}

function StatusBody({ status, now }: { status: StatusData; now: Date }) {
  const { latest, uptime } = status;
  const incident = uptime.lastIncident;
  const checks = latest ? Object.entries(latest.checks ?? {}) : [];
  const failing = checks.filter(([, check]) => !check.ok).map(([name]) => name);
  if (!latest) return <Empty>No health check has been recorded yet. Run the Uptime workflow once from GitHub Actions.</Empty>;
  return (
    <Stack direction="column" gap="lg">
      <Stack direction="column" gap="sm">
        <Typography variant="body">
          {checks.length === 0 ? "The check recorded no individual results" : failing.length === 0 ? `All ${checks.length} checks passed` : `${failing.join(", ")} failing`} {ago(latest.created_at, now)} ({when(latest.created_at)}, {latest.total_latency_ms} ms in total).
        </Typography>
        <Stack direction="row" gap="md" wrap>
          {checks.map(([name, check]) => (
            <Stack key={name} direction="row" gap="xs" alignItems="center">
              <SeverityLabel level={check.ok ? "ok" : "error"} label={name} />
              {(check.detail || check.metrics) && (
                <Typography variant="small" color="subdued">
                  {dot([check.detail, check.metrics ? Object.entries(check.metrics).map(([k, v]) => `${k} ${v}`).join(", ") : null])}
                </Typography>
              )}
            </Stack>
          ))}
        </Stack>
      </Stack>

      {uptime.monitoringSince !== null && (
        <Typography variant="small" color="subdued">
          Monitoring began {ago(new Date(uptime.monitoringSince).toISOString(), now)} ({when(uptime.monitoringSince)}), so the uptime below covers that time rather than the whole range.
        </Typography>
      )}

      <UptimeStrip slots={uptime.slots} />

      <Stats>
        <Stat label="Uptime" value={uptime.uptimePct === null ? "–" : `${uptime.uptimePct.toFixed(2)}%`} note={`${uptime.okSlots} healthy and ${uptime.failingSlots} failing 15-minute slots`} />
        <Stat label="Missed checks" value={String(uptime.noDataSlots)} note={`of ${uptime.slots.length} slots had no check recorded`} />
        <Stat label="Deployed release" value={status.deployedRelease} note={latest.release === status.deployedRelease ? "Matches the latest check" : `The latest check ran on ${latest.release}`} />
        <Stat label="Last incident" value={incident ? formatDuration(incident.end - incident.start) : "None"} note={incident ? `${when(incident.start)} to ${when(incident.end)}` : "In this range"} />
      </Stats>

      {uptime.possibleOutages.length > 0 && (
        <Stack direction="column" gap="xs">
          <Typography variant="label">Possible outages (no check for 30 minutes or more)</Typography>
          {uptime.possibleOutages.map((run) => (
            <Typography key={run.start} variant="small">
              {when(run.start)} to {when(run.end)} ({formatDuration(run.end - run.start)})
            </Typography>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

const snippet = (message: string, max = 90): string => (message.length > max ? `${message.slice(0, max).trimEnd()}…` : message || "(no message)");

function contextText(context: Record<string, unknown>, digest: string | null): string {
  const parts = Object.entries(context ?? {}).map(([key, value]) => `${key} ${String(value)}`);
  if (digest) parts.push(`digest ${digest}`);
  return parts.join(" · ") || "–";
}

/** One error group opened: its message, the facts as label/value pairs, recent occurrences and where to investigate. Mounted only once the row is open. */
function ErrorDetails({ group, now, range, links }: { group: ErrorGroup; now: Date; range: Range; links: AdminLinks }) {
  // The 24-hour range's "7 days" is only those 24 hours (the query counts within the range), so it isn't shown there.
  const events = range === "24h" ? `${group.count_24h} in 24 h` : `${group.count_24h} in 24 h, ${group.count_7d} in 7 d`;
  return (
    <Stack direction="column" gap="md">
      <Typography variant="small" color="subdued">
        {group.message || "(no message)"}
      </Typography>
      <ResponsiveGrid cols={2} colsMd={4} gapX="4" gapY="3">
        <Field label="Route" value={group.route ?? "No route"} />
        <Field label="Source" value={group.source} />
        <Field label="Households affected" value={String(group.households)} />
        <Field label="Events" value={events} />
        <Field label="First seen" value={`${ago(group.first_seen, now)} (${when(group.first_seen)})`} />
        <Field label="Last seen" value={`${ago(group.last_seen, now)} (${when(group.last_seen)})`} />
        <Field label="Releases" value={group.releases.join(", ") || "–"} />
      </ResponsiveGrid>
      <Stack direction="column" gap="xs">
        <Typography variant="label">Recent occurrences</Typography>
        <List>
          {group.latest.map((o) => (
            <ListItem key={`${o.created_at}-${o.release}-${o.digest ?? ""}`} primary={when(o.created_at)} secondary={dot([`release ${o.release}`, o.source, contextText(o.context, o.digest)])} />
          ))}
        </List>
      </Stack>
      <Stack direction="column" gap="xs">
        <Typography variant="label">Investigate</Typography>
        <LinkButtons links={errorInvestigateLinks(group, links).map((link) => ({ ...link, external: true }))} />
      </Stack>
    </Stack>
  );
}

export function Errors({ data, now, range, links }: { data: Loaded<ErrorGroup[]>; now: Date; range: Range; links: AdminLinks }) {
  return (
    <Section
      id="errors"
      title="Errors"
      note="Grouped so repeats count once. Open a row for the details."
      detail="Open one to see where and when it happened. Severity and state come from the counts: a spike is today's count well over the usual daily rate, and a server-side error that hit two or more households is an Error. Messages are scrubbed of emails, links and ids."
      actions={<LinkButtons links={[{ label: "Runtime logs", href: links.targets.vercelLogs, external: true }]} />}
    >
      {!data.ok ? (
        <NotLoaded hint={data.hint} />
      ) : data.data.length === 0 ? (
        <Empty>No errors in this range.</Empty>
      ) : (
        <Stack direction="column" gap="sm">
          {data.data.length >= ERROR_GROUP_LIMIT && (
            <Typography variant="small" color="subdued">
              {`Showing the ${ERROR_GROUP_LIMIT} most recently seen kinds of error; older ones in this range aren't listed or counted.`}
            </Typography>
          )}
          <List>
            {prioritiseErrors(data.data, now, range).map(({ group, triage }) => (
              <ExpandableItem
                key={group.fingerprint}
                lazy
                primary={
                  <>
                    <strong>{group.label ?? group.kind}</strong>
                    {group.label ? "" : ` – ${snippet(group.message)}`}
                  </>
                }
                secondary={dot([group.route ?? group.source, `${group.count}×`, plural(group.households, "household"), `last ${ago(group.last_seen, now)}`])}
                badge={
                  <Stack direction="row" gap="xs" alignItems="center">
                    <SeverityLabel level={triage.level} label={triage.levelLabel} />
                    <Tag size="small">{triage.stateLabel}</Tag>
                  </Stack>
                }
              >
                <ErrorDetails group={group} now={now} range={range} links={links} />
              </ExpandableItem>
            ))}
          </List>
        </Stack>
      )}
    </Section>
  );
}

export function AiAgent({ data }: { data: Loaded<AiSummary> }) {
  return (
    <Section
      id="ai"
      title="AI agent"
      note="Calls, success rate, speed and cost over the range."
      detail="How many calls the AI agent made, how often they worked, how long they took and what they cost. Days run midnight to midnight UTC."
    >
      {!data.ok ? <NotLoaded hint={data.hint} /> : <AiBody ai={data.data} />}
    </Section>
  );
}

function AiBody({ ai }: { ai: AiSummary }) {
  const maxCalls = Math.max(1, ...ai.daily.map((day) => day.calls));
  if (ai.by_task.length === 0) return <Empty>No AI calls in this range.</Empty>;
  return (
    <Stack direction="column" gap="lg">
      <List>
        {ai.by_task.map((r) => {
          const problems = aiProblems(r);
          return (
            <ListItem
              key={`${r.task}-${r.model}`}
              primary={r.task}
              secondary={dot([
                r.model,
                plural(r.calls, "call"),
                `${successPct(r.ok_calls, r.calls) ?? "–"}% worked`,
                r.p50_ms === null ? null : `median ${r.p50_ms} ms`,
                r.p95_ms === null ? null : `slowest 5% ${r.p95_ms} ms`,
                `tokens in/out ${r.avg_input_tokens ?? "–"} / ${r.avg_output_tokens ?? "–"}`,
                formatUsd(Number(r.cost_usd)),
              ])}
              badge={problems === "None" ? undefined : <SeverityLabel level="error" label={problems} />}
            />
          );
        })}
      </List>

      <Stack direction="column" gap="xs">
        <Typography variant="label">Calls per day</Typography>
        {ai.daily.map((day) => (
          <Stack key={day.day} direction="column" gap="xs">
            <Typography variant="small">
              {day.day}: {day.calls} calls, {day.ok_calls} ok, {formatUsd(Number(day.cost_usd))}
            </Typography>
            <Bar value={day.calls} max={maxCalls} label={`${day.day}: ${day.calls} calls, ${day.ok_calls} ok`} tone={day.ok_calls < day.calls ? "bad" : "ok"} />
          </Stack>
        ))}
      </Stack>

      <Stack direction="column" gap="xs">
        <Typography variant="label">Latest failed calls</Typography>
        {ai.failures.length === 0 ? (
          <Empty>No failed calls in this range.</Empty>
        ) : (
          <List>
            {ai.failures.map((f) => (
              <ListItem
                key={`${f.created_at}-${f.task}-${f.model}-${f.status}-${f.error_code ?? ""}-${f.latency_ms}`}
                primary={`${when(f.created_at)} · ${f.task}`}
                secondary={dot([f.model, f.status, f.error_code, `${f.latency_ms} ms`])}
              />
            ))}
          </List>
        )}
      </Stack>
    </Stack>
  );
}

export function CostAndQuotas({ data }: { data: Loaded<CostData> }) {
  return (
    <Section
      id="cost"
      title="Cost and quotas"
      note="AI spend against the daily cap, Coles lookups against the monthly limit."
      detail="The daily spend resets at midnight UTC. Raise the cap with AI_DAILY_SPEND_CAP_USD and the Coles limit with COLES_API_MONTHLY_LIMIT in Vercel."
    >
      {!data.ok ? <NotLoaded hint={data.hint} /> : <CostBody cost={data.data} />}
    </Section>
  );
}

function CostBody({ cost }: { cost: CostData }) {
  const spendPct = cost.capUsd > 0 ? (cost.spendTodayUsd / cost.capUsd) * 100 : 0;
  const colesFraction = cost.coles ? cost.coles.used / cost.coles.limit : 0;
  return (
    <Stack direction="column" gap="lg">
      <Stats>
        <Stat label="AI spend today (UTC)" value={`${formatUsd(cost.spendTodayUsd)} of ${formatUsd(cost.capUsd)}`} note={`${Math.round(spendPct)}% of the daily cap`} />
        <Stat label="Month to date" value={formatUsd(cost.monthToDateUsd)} note={`Day ${cost.daysElapsed.toFixed(1)} of ${cost.daysInMonth}`} />
        <Stat label="Projected month end" value={formatUsd(cost.projectedMonthUsd)} note="This month so far, scaled up to a full month" />
      </Stats>
      <Bar value={cost.spendTodayUsd} max={cost.capUsd} label={`${Math.round(spendPct)}% of the daily AI spend cap`} tone={spendPct >= 100 ? "bad" : spendPct >= 80 ? "warning" : "ok"} />
      {cost.coles ? (
        <Stack direction="column" gap="sm">
          <Stat label={`Coles lookups, ${cost.coles.month}`} value={`${cost.coles.used} of ${cost.coles.limit}`} note={`${cost.coles.remaining} remaining`} />
          <Bar value={cost.coles.used} max={cost.coles.limit} label={`${cost.coles.used} of ${cost.coles.limit} Coles lookups used`} tone={colesFraction >= 1 ? "bad" : colesFraction >= 0.8 ? "warning" : "ok"} />
        </Stack>
      ) : (
        <NotLoaded hint="is migration 018 applied?" />
      )}
    </Stack>
  );
}

export function Households({ data, range, selected, now }: { data: Loaded<HouseholdRow[]>; range: Range; selected: string | null; now: Date }) {
  const href = (shortId: string) => (shortId === selected ? `/admin?range=${range}#households` : `/admin?range=${range}&household=${shortId}#households`);
  return (
    <Section
      id="households"
      title="Households"
      note="Most recently active first. Select an ID to filter the page."
      detail="IDs are short on purpose (no names or emails), and You marks your own household. Select an ID to filter the errors, AI and usage sections; select it again to clear."
    >
      {!data.ok ? (
        <NotLoaded hint={data.hint} />
      ) : data.data.length === 0 ? (
        <Empty>No households yet.</Empty>
      ) : (
        <List>
          {data.data.map((h) => (
            <ListItem
              key={h.shortId}
              selected={h.shortId === selected}
              // ListItem renders `primary` inside a <p>, so only inline content (text, a link,
              // a Tag) may go here: a Stack or other block element is invalid HTML and fails
              // hydration (React #418). Design-system gap: ListItem could render it in a div.
              primary={
                <>
                  <Link href={href(h.shortId)} aria-label={`Filter the page to household ${h.shortId}`}>
                    {h.shortId}
                  </Link>
                  {h.isYou && (
                    <>
                      {" "}
                      <Tag size="small">You</Tag>
                    </>
                  )}
                </>
              }
              secondary={dot([
                plural(h.members, "member"),
                h.pending_invites > 0 && plural(h.pending_invites, "pending invite"),
                `active ${ago(h.last_active, now)}`,
                `plan this week: ${h.has_plan_this_week ? "yes" : "no"}`,
                `settings done: ${h.settings_complete ? "yes" : "no"}`,
                `${plural(h.ai_calls, "AI call")} (${formatUsd(Number(h.ai_cost_usd))})`,
              ])}
              badge={h.errors > 0 ? <SeverityLabel level="warning" label={plural(h.errors, "error")} /> : undefined}
            />
          ))}
        </List>
      )}
    </Section>
  );
}

const FUNNEL: { type: string; text: string }[] = [
  { type: "plan_confirmed", text: "confirmed" },
  { type: "shopping_list_built", text: "list built" },
  { type: "coles_list_sent", text: "sent to Coles" },
  { type: "shopping_completed", text: "shopping done" },
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
      note="How far households get through the weekly routine."
      detail="Compose a plan, confirm it, build the shopping list, send it to Coles, finish shopping. Weeks start on Monday in each household's own time zone (Sydney if unset), and each step counts toward the week the plan was for."
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
      <Typography variant="body">{cycleSentence(cycle)}</Typography>
      {!events.available && (
        <Typography variant="small" color="subdued">
          {"Migration 020 isn't applied, so every step after composing shows 0."}
        </Typography>
      )}

      <Stats>
        <Stat label="Edits per plan" value={composedTotal > 0 ? (manual / composedTotal).toFixed(1) : "–"} note={`${sum(events.swaps)} swaps and deletes and ${sum(events.edits)} accepted edits across ${composedTotal} composed plans`} />
        <Stat
          label="Recipes added"
          value={`${bySource("recipes_ai") + bySource("recipes_imported") + bySource("recipes_user_added")}`}
          note={`${bySource("recipes_ai")} by AI, ${bySource("recipes_imported")} imported, ${bySource("recipes_user_added")} by hand (photo and typed entry can't be told apart)`}
        />
        <Stat
          label="Cuisines cooked"
          value={cycle.cuisines.avg === null ? "–" : String(cycle.cuisines.avg)}
          note={cycle.cuisines.households > 0 ? `On average per household, across ${plural(cycle.cuisines.households, "household")} (most: ${cycle.cuisines.max})` : "No cooked history yet"}
        />
        <Stat label="Ratings given" value={events.ratings.count} note={events.ratings.avg === null ? "None yet" : `Average ${events.ratings.avg} stars`} />
      </Stats>

      <Disclosure title="Week by week" summary={`the last ${cycle.weeks.length} weeks, households at each step`}>
        <List>
          {cycle.weeks.map((w) => (
            <ListItem
              key={w.week_start}
              primary={`Week of ${weekLabel(w.week_start)}`}
              secondary={dot([`${w.composed} composed`, ...FUNNEL.map(({ type, text }) => `${funnelCell(at(w.week_start, type), w.composed)} ${text}`)])}
            />
          ))}
        </List>
      </Disclosure>

      <Disclosure title="Raw event counts" summary={countsSorted.length === 0 ? "none in these weeks" : plural(countsSorted.length, "kind")}>
        {countsSorted.length === 0 ? (
          <Empty>No events in these weeks.</Empty>
        ) : (
          <Stack direction="row" gap="sm" wrap>
            {countsSorted.map(([type, n]) => (
              <Tag key={type} size="small">{`${type} ${n}`}</Tag>
            ))}
          </Stack>
        )}
      </Disclosure>
    </Stack>
  );
}

export function Database({ data, links }: { data: Loaded<{ stats: DbStat[]; schema: SchemaCheck[] }>; links: AdminLinks }) {
  return (
    <Section
      id="database"
      title="Database"
      note="Whether every migration has run, and how big the tables are."
      detail="Row counts are Postgres estimates, and a small table can read 0 until Postgres next analyses it."
      actions={links.targets.supabaseSql ? <LinkButtons links={[{ label: "SQL editor", href: links.targets.supabaseSql, external: true }]} /> : undefined}
    >
      {!data.ok ? <NotLoaded hint={data.hint} /> : <DatabaseBody stats={data.data.stats} schema={data.data.schema} links={links} />}
    </Section>
  );
}

function DatabaseBody({ stats, schema, links }: { stats: DbStat[]; schema: SchemaCheck[]; links: AdminLinks }) {
  const summary = databaseSummary(stats, schema);
  return (
    <Stack direction="column" gap="lg">
      <Stack direction="column" gap="xs">
        <Typography variant="body">{summary.migrations}</Typography>
        {summary.missing.length > 0 && (
          <Stack direction="row" gap="sm" wrap>
            {summary.missing.map((migration) => (
              <SeverityLabel key={migration} level="error" label={`${migration} MISSING`} />
            ))}
          </Stack>
        )}
        {summary.needVacuum.length > 0 && (
          <Typography variant="small" color="subdued">
            {summary.needVacuum.join(", ")} {summary.needVacuum.length === 1 ? "has" : "have"} many dead rows and may need a vacuum.
          </Typography>
        )}
      </Stack>
      <Disclosure title="Tables" summary={`${summary.tables} tables, ${formatBytes(summary.totalBytes)} in total`}>
        <List>
          {stats.map((s) => (
            <ListItem
              key={s.table}
              primary={s.table}
              secondary={dot([`${s.rows.toLocaleString("en-AU")} rows (estimate)`, formatBytes(s.size_bytes), `${(s.dead_ratio * 100).toFixed(1)}% dead rows`])}
              badge={hasManyDeadTuples(s) ? <SeverityLabel level="warning" label="High dead tuples" /> : undefined}
            />
          ))}
        </List>
      </Disclosure>
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
  );
}

export function DebugLinks({ links }: { links: AdminLinks }) {
  const { debug } = links;
  return (
    <Section id="debug" title="Debug pages" note="Pages for digging into one thing.">
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
