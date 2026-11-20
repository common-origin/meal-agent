"use client";

/**
 * Small building blocks for the /admin page. Everything here is a design-system
 * part (Box, ResponsiveGrid, Stack, List/ListItem, ProgressBar, Typography,
 * InlineAlert) arranged for this page: no table or chart code, and no custom
 * CSS beyond one inline `flex` in UptimeStrip that sizes each run of slots
 * (the design system's Box has no flex-grow prop).
 * The design system has no Table or DataTable, so DataGrid lays columns out on
 * its Grid with ARIA table roles (gap: a DataTable replaces it), and BarRow is
 * the stand-in for a bar chart (gap: a chart or BarList replaces it).
 */

import { useState, type ReactNode } from "react";
import { Box, Grid, GridCol, IconButton, InlineAlert, List, ListItem, ProgressBar, ResponsiveGrid, Stack, StatusLabel, Tooltip, Typography, tokens } from "@common-origin/design-system";
import type { Tone } from "@/lib/admin/headline";
import type { Level } from "@/lib/admin/types";
import { ago, formatDuration, utcStamp } from "@/lib/admin/format";
import { useMediaQuery } from "./useMediaQuery";

// The one severity vocabulary for the page (#279). The design system has no warning status
// (gap: it needs a StatusLabel `warning`), so a warning is `pending` with a "Warning" label.
const LEVEL_STATUS = { error: "failed", warning: "pending", ok: "completed", unknown: "cancelled" } as const;
const LEVEL_WORD: Record<Level, string> = { error: "Error", warning: "Warning", ok: "OK", unknown: "Unknown" };

/** How bad something is, as a design-system StatusLabel. Static on load, so it isn't announced as a live region. */
export function SeverityLabel({ level, label }: { level: Level; label?: string }) {
  return <StatusLabel status={LEVEL_STATUS[level]} label={label ?? LEVEL_WORD[level]} size="small" liveRegion={false} />;
}

const TONE_LEVEL: Record<Tone, Level | null> = { ok: "ok", warning: "warning", bad: "error", neutral: null };

/**
 * A titled region of the page, on a raised surface (#282). The title is on the
 * left (with an info button whose tooltip holds the longer explanation, out of
 * the scan path) and `actions` are on the right; `note` is one line at most.
 * The region's accessible name is its title.
 */
export function Section({ id, title, note, detail, actions, children }: { id: string; title: string; note?: string; detail?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <Box as="section" id={id} aria-label={title} bg="surface.raised" border="default" borderRadius="md" p="lg">
      <Stack direction="column" gap="md">
        <Stack direction="column" gap="xs">
          <Stack direction="row" gap="md" alignItems="center" justifyContent="space-between" wrap>
            <Stack direction="row" gap="xs" alignItems="center">
              <Typography variant="h2">{title}</Typography>
              {detail && (
                <Tooltip text={detail} kind="description" side="right">
                  <IconButton variant="naked" size="small" iconName="info" aria-label={`About ${title}`} />
                </Tooltip>
              )}
            </Stack>
            {actions}
          </Stack>
          {note && (
            <Typography variant="small" color="subdued">
              {note}
            </Typography>
          )}
        </Stack>
        {children}
      </Stack>
    </Box>
  );
}

/** A section whose data couldn't be read: it says so and which migration to check, and the rest of the page carries on. */
export function NotLoaded({ hint }: { hint: string }) {
  return <InlineAlert variant="warning">{`Couldn't load (${hint})`}</InlineAlert>;
}

/**
 * A row that opens to show more. Use inside a List. The design system keeps a
 * closed row's content in the page (hidden); `lazy` renders it only once the
 * row is open, for long lists of heavy rows (up to 100 error groups).
 */
export function ExpandableItem({ primary, secondary, badge, lazy = false, defaultExpanded = false, children }: { primary: ReactNode; secondary?: ReactNode; badge?: ReactNode; lazy?: boolean; defaultExpanded?: boolean; children: ReactNode }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <ListItem expandable expanded={expanded} onToggle={() => setExpanded((open) => !open)} primary={primary} secondary={secondary} badge={badge}>
      {lazy && !expanded ? null : children}
    </ListItem>
  );
}

/** Detail most visits don't need: one closed row with a summary of what's inside. */
export function Disclosure({ title, summary, defaultExpanded = false, children }: { title: string; summary?: string; defaultExpanded?: boolean; children: ReactNode }) {
  return (
    <List dividers={false}>
      <ExpandableItem primary={title} secondary={summary} defaultExpanded={defaultExpanded}>
        {children}
      </ExpandableItem>
    </List>
  );
}

const BAR_COLOR = { ok: "success", warning: "default", bad: "error", neutral: "default" } as const;

/** A horizontal bar for `value` out of `max`, named for screen readers. */
export function Bar({ value, max, label, tone = "neutral" }: { value: number; max: number; label: string; tone?: Tone }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return <ProgressBar value={pct} color={BAR_COLOR[tone]} height="sm" aria-label={label} />;
}

/** One row of a label, a bar and its value. On a phone the value sits beside the label and the bar drops under both. */
export function BarRow({ label, value, bar }: { label: string; value: ReactNode; bar: ReactNode }) {
  return (
    <Grid cols={12} gapX="3" gapY="1" data-testid={`bar-row-${label}`}>
      <GridCol span={6} spanMd={3}>
        <Typography variant="small" as="div">
          {label}
        </Typography>
      </GridCol>
      <GridCol span={12} spanMd={5} order={3} orderMd={2}>
        <Box display="flex" alignItems="center" height="100%">
          <Box width="100%">{bar}</Box>
        </Box>
      </GridCol>
      <GridCol span={6} spanMd={4} order={2} orderMd={3}>
        <Typography variant="small" color="subdued" as="div">
          {value}
        </Typography>
      </GridCol>
    </Grid>
  );
}

// Where the columns have room: from the medium breakpoint up to just below the large one (full width, no
// sidebar), and again from the extra-large one. Between them the side navigation takes a quarter of the
// page and 12 columns are too narrow for a label or a figure, so rows fall back to label/value pairs.
const { md, lg, xl } = tokens.base.breakpoint;
const COLUMNS_QUERY = `(min-width: ${md}) and (max-width: ${parseFloat(lg) - 0.02}px), (min-width: ${xl})`;

export interface Column<Row> {
  id: string;
  /** The column's label: the header where the columns fit (see COLUMNS_QUERY), beside each value elsewhere. */
  header: string;
  /** Width out of 12 columns where the columns fit. */
  span: number;
  /** Numbers line up on the right where the columns fit. */
  numeric?: boolean;
  /** The row's name: shown first and across the whole row on a phone, without a label. */
  primary?: boolean;
  /** Width out of 12 on a phone, for a column that isn't primary. Default 6 (two across). */
  narrowSpan?: 4 | 6 | 12;
  cell: (row: Row) => ReactNode;
}

const narrow = (column: Pick<Column<never>, "primary" | "narrowSpan">): number => (column.primary ? 12 : (column.narrowSpan ?? 6));

const asContent = (value: ReactNode): ReactNode =>
  typeof value === "string" || typeof value === "number" ? (
    <Typography variant="small" as="div">
      {value}
    </Typography>
  ) : (
    value
  );

/**
 * Rows with real columns, standing in for a DataTable (a design-system gap).
 * Where the columns fit it is a header row over aligned rows; elsewhere (a
 * phone, or beside the side navigation) each cell carries its own label
 * (label/value pairs), the first column naming the row. ARIA table roles give
 * assistive tech the structure a native table has. `footer` adds a full-width
 * line under a row (what went wrong, say), and `selected` shades a row.
 */
export function DataGrid<Row>({ label, columns, rows, rowKey, selected, footer }: { label: string; columns: Column<Row>[]; rows: Row[]; rowKey: (row: Row) => string; selected?: (row: Row) => boolean; footer?: (row: Row) => ReactNode }) {
  const wide = useMediaQuery(COLUMNS_QUERY);
  return (
    <Box role="table" aria-label={label}>
      {wide && (
        <Box role="row" borderBottom="default" pb="xs">
          <Grid cols={12} gapX="3">
            {columns.map((column) => (
              <GridCol key={column.id} span={column.span}>
                <Box role="columnheader">
                  <Stack direction="row" justifyContent={column.numeric ? "flex-end" : "flex-start"}>
                    <Typography variant="caption" color="subdued" as="div">
                      {column.header}
                    </Typography>
                  </Stack>
                </Box>
              </GridCol>
            ))}
          </Grid>
        </Box>
      )}
      {rows.map((row) => {
        const isSelected = selected?.(row) ?? false;
        const extra = footer?.(row);
        return (
          <Box key={rowKey(row)} role="row" borderBottom="default" py="sm" bg={isSelected ? "color.fill.muted" : undefined}>
            <Stack direction="column" gap="xs">
              <Grid cols={12} gapX="3" gapY="2">
                {columns.map((column) => {
                  const value = asContent(column.cell(row));
                  return (
                    <GridCol key={column.id} span={narrow(column)} spanMd={column.span} spanLg={narrow(column)} spanXl={column.span}>
                      <Box role="cell">
                        {wide || column.primary ? (
                          <Stack direction="row" justifyContent={wide && column.numeric ? "flex-end" : "flex-start"} alignItems="center" gap="xs">
                            {value}
                          </Stack>
                        ) : (
                          <Stack direction="column" gap="xs">
                            <Typography variant="caption" color="subdued" as="div">
                              {column.header}
                            </Typography>
                            {value}
                          </Stack>
                        )}
                      </Box>
                    </GridCol>
                  );
                })}
              </Grid>
              {extra && <Box role="cell">{extra}</Box>}
            </Stack>
          </Box>
        );
      })}
    </Box>
  );
}

type SlotState = "ok" | "failing" | "no_data";
const SLOT_FILL = { ok: "color.fill.success", failing: "color.fill.danger", no_data: "color.fill.muted" } as const;
const SLOT_WORD: Record<SlotState, string> = { ok: "Healthy", failing: "Check failing", no_data: "No check recorded" };
const SLOT_MS = 15 * 60_000;

/**
 * The uptime tracker (a design-system gap: there is no Tracker): one cell per
 * 15-minute slot (ok, failing, or no data), with where it starts and ends under
 * it, the uptime % beside it and an inline key. Neighbouring slots in one state
 * are one cell as wide as the run is long (30 days is a handful of elements, not
 * 2,880), and each run's tooltip gives its state and time range. A tooltip can't
 * open on touch or by keyboard (and a tab stop per run would be hundreds), so
 * what matters is also in text: the strip names its counts, the key names the
 * states, and the outages are listed below it.
 */
export function UptimeStrip({ slots, from, now, uptimePct }: { slots: { start: number; state: SlotState }[]; from: number; now: Date; uptimePct: number | null }) {
  if (slots.length === 0) {
    return (
      <Typography variant="small" color="subdued">
        No completed 15-minute slots in this range yet.
      </Typography>
    );
  }
  const count = (state: SlotState) => slots.filter((slot) => slot.state === state).length;
  const runs = slots.reduce<{ state: SlotState; start: number; length: number }[]>((acc, slot) => {
    const last = acc[acc.length - 1];
    if (last && last.state === slot.state) last.length += 1;
    else acc.push({ state: slot.state, start: slot.start, length: 1 });
    return acc;
  }, []);
  return (
    <Grid cols={12} gapX="6" gapY="4" data-testid="uptime-tracker">
      <GridCol span={12} spanMd={9}>
        <Stack direction="column" gap="xs">
          <Box display="flex" gap="none" role="img" aria-label={`Uptime: ${count("ok")} ok, ${count("failing")} failing, ${count("no_data")} no data, in ${slots.length} slots of 15 minutes`}>
            {runs.map((run) => (
              <Tooltip key={run.start} text={`${SLOT_WORD[run.state]}: ${utcStamp(run.start)} to ${utcStamp(run.start + run.length * SLOT_MS)} (${formatDuration(run.length * SLOT_MS)})`} kind="description" side="top">
                <Box bg={SLOT_FILL[run.state]} height="28px" minWidth="1px" style={{ flex: `${run.length} 1 0` }} />
              </Tooltip>
            ))}
          </Box>
          <Stack direction="row" justifyContent="space-between" gap="md">
            <Typography variant="caption" color="subdued">
              {ago(new Date(from).toISOString(), now)}
            </Typography>
            <Typography variant="caption" color="subdued">
              Now
            </Typography>
          </Stack>
          <Stack direction="row" gap="md" wrap>
            {(Object.keys(SLOT_WORD) as SlotState[]).map((state) => (
              <Stack key={state} direction="row" gap="xs" alignItems="center">
                <Box bg={SLOT_FILL[state]} width="12px" height="12px" borderRadius="sm" />
                <Typography variant="caption" color="subdued">
                  {state === "no_data" ? "No check recorded (usually GitHub skipping a run, not downtime)" : SLOT_WORD[state]}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Stack>
      </GridCol>
      <GridCol span={12} spanMd={3}>
        <Stat label="Uptime" value={uptimePct === null ? "–" : `${uptimePct.toFixed(2)}%`} note={`${count("ok")} healthy and ${count("failing")} failing 15-minute slots`} />
      </GridCol>
    </Grid>
  );
}

const METER_WORD: Record<Level, string> = { error: "At the limit", warning: "Near the limit", ok: "OK", unknown: "Unknown" };
const METER_TONE: Record<Level, Tone> = { error: "bad", warning: "warning", ok: "ok", unknown: "neutral" };

/**
 * A usage meter on a card (a design-system gap: there is no Card or meter): what
 * it measures, how bad (a severity label), the figure, a bar, a note, and the
 * setting that sets the limit, named in visible text because a tooltip can't
 * open on touch. Every meter has the same anatomy so they read side by side.
 */
export function Meter({ label, value, used, limit, level, note, limitNote }: { label: string; value: string; used: number; limit: number; level: Level; note: string; limitNote: string }) {
  return (
    <Box bg="color.fill.muted" border="default" borderRadius="sm" p="md" data-testid={`meter-${label}`}>
      <Stack direction="column" gap="sm">
        <Stack direction="row" gap="sm" alignItems="center" justifyContent="space-between" wrap>
          <Typography variant="caption" color="subdued">
            {label}
          </Typography>
          <SeverityLabel level={level} label={METER_WORD[level]} />
        </Stack>
        <Typography variant="h3" as="div">
          {value}
        </Typography>
        <Bar value={used} max={limit} label={`${label}: ${value}`} tone={METER_TONE[level]} />
        <Typography variant="small" color="subdued">
          {note}
        </Typography>
        <Typography variant="small" color="subdued">
          {limitNote}
        </Typography>
      </Stack>
    </Box>
  );
}

export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <Stack direction="column" gap="xs">
      <Typography variant="caption" color="subdued">
        {label}
      </Typography>
      <Typography variant="h3" as="div">
        {value}
      </Typography>
      {note && (
        <Typography variant="small" color="subdued">
          {note}
        </Typography>
      )}
    </Stack>
  );
}

/** Stats laid out on the design system's grid: two across on a phone, four from the medium breakpoint. */
export function Stats({ children }: { children: ReactNode }) {
  return (
    <ResponsiveGrid cols={2} colsMd={4} gapX="4" gapY="4">
      {children}
    </ResponsiveGrid>
  );
}

/**
 * A headline number linking to its section, which states its time frame in its
 * label. The whole card is clickable (the label stays the real link for the
 * keyboard and screen readers). Its state is a severity label, and the value
 * and note say the same in words.
 */
export function Tile({ label, value, note, tone, href }: { label: string; value: string; note: string; tone: Tone; href: string }) {
  const level = TONE_LEVEL[tone];
  return (
    <Box
      bg="color.fill.muted"
      border="default"
      borderRadius="sm"
      p="md"
      cursor="pointer"
      onClick={(event) => {
        // The label is the real link: a click on it, or the end of selecting text, isn't a click on the card.
        if (event.target instanceof Element && event.target.closest("a")) return;
        if (window.getSelection()?.toString()) return;
        // Scroll ourselves: setting location.hash to the hash it already has (a second click) doesn't move the page.
        const id = href.replace(/^#/, "");
        window.history.pushState(null, "", `#${id}`);
        document.getElementById(id)?.scrollIntoView();
      }}
    >
      <Stack direction="column" gap="xs">
        {/* The label has the full width to itself; the severity sits beside the value and drops under it on a narrow card (two across on a phone). */}
        <Typography variant="caption" color="subdued">
          <a href={href}>{label}</a>
        </Typography>
        <Stack direction="row" gap="sm" alignItems="center" justifyContent="space-between" wrap>
          <Typography variant="h3" as="div">
            {value}
          </Typography>
          {level && <SeverityLabel level={level} />}
        </Stack>
        <Typography variant="small" color="subdued">
          {note}
        </Typography>
      </Stack>
    </Box>
  );
}

/** A label over a value, for the details of one thing (an error's route, its first seen, …). */
export function Field({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="column" gap="xs">
      <Typography variant="caption" color="subdued">
        {label}
      </Typography>
      <Typography variant="small" as="div">
        {value}
      </Typography>
    </Stack>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <Typography variant="body" color="subdued">
      {children}
    </Typography>
  );
}
