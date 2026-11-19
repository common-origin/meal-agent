"use client";

/**
 * Small building blocks for the /admin page. Everything here is a design-system
 * part (Box, ResponsiveGrid, Stack, List/ListItem, ProgressBar, Typography,
 * InlineAlert) arranged for this page: no table or chart code, and no custom
 * CSS beyond one inline `flex` in UptimeStrip that sizes each run of slots
 * (the design system's Box has no flex-grow prop).
 * The design system has no Table, so rows are List/ListItem with their numbers
 * in the secondary line.
 */

import { useState, type ReactNode } from "react";
import { Box, IconButton, InlineAlert, List, ListItem, ProgressBar, ResponsiveGrid, Stack, StatusLabel, Tooltip, Typography } from "@common-origin/design-system";
import type { Tone } from "@/lib/admin/headline";
import type { Level } from "@/lib/admin/types";

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
export function ExpandableItem({ primary, secondary, badge, lazy = false, children }: { primary: ReactNode; secondary?: ReactNode; badge?: ReactNode; lazy?: boolean; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <ListItem expandable expanded={expanded} onToggle={() => setExpanded((open) => !open)} primary={primary} secondary={secondary} badge={badge}>
      {lazy && !expanded ? null : children}
    </ListItem>
  );
}

/** Detail most visits don't need: one closed row with a summary of what's inside. */
export function Disclosure({ title, summary, children }: { title: string; summary?: string; children: ReactNode }) {
  return (
    <List dividers={false}>
      <ExpandableItem primary={title} secondary={summary}>
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

const SLOT_FILL = { ok: "color.fill.success", failing: "color.fill.danger", no_data: "color.fill.muted" } as const;

/** One cell per 15-minute slot: ok, failing, or no data. Never colour alone: the strip names its counts, and the legend names the states. */
export function UptimeStrip({ slots }: { slots: { start: number; state: "ok" | "failing" | "no_data" }[] }) {
  if (slots.length === 0) {
    return (
      <Typography variant="small" color="subdued">
        No completed 15-minute slots in this range yet.
      </Typography>
    );
  }
  const count = (state: "ok" | "failing" | "no_data") => slots.filter((slot) => slot.state === state).length;
  // Neighbouring slots in the same state become one cell, as wide as the run is long, so 30 days is a handful of elements, not 2,880.
  const runs = slots.reduce<{ state: "ok" | "failing" | "no_data"; start: number; length: number }[]>((acc, slot) => {
    const last = acc[acc.length - 1];
    if (last && last.state === slot.state) last.length += 1;
    else acc.push({ state: slot.state, start: slot.start, length: 1 });
    return acc;
  }, []);
  return (
    <Stack direction="column" gap="xs">
      <Box display="flex" gap="none" role="img" aria-label={`Uptime: ${count("ok")} ok, ${count("failing")} failing, ${count("no_data")} no data, in ${slots.length} slots of 15 minutes`}>
        {runs.map((run) => (
          <Box key={run.start} bg={SLOT_FILL[run.state]} height="28px" minWidth="1px" style={{ flex: `${run.length} 1 0` }} />
        ))}
      </Box>
      <Typography variant="small" color="subdued">
        Each cell is 15 minutes. Green: checked and healthy. Red: a check failed. Grey: no check was recorded, usually GitHub skipping a run rather than downtime.
      </Typography>
    </Stack>
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
      onClick={() => {
        window.location.hash = href.replace(/^#/, "");
      }}
    >
      <Stack direction="column" gap="xs">
        <Stack direction="row" gap="sm" alignItems="center" justifyContent="space-between">
          <Typography variant="caption" color="subdued">
            <a href={href}>{label}</a>
          </Typography>
          {level && <SeverityLabel level={level} />}
        </Stack>
        <Typography variant="h3" as="div">
          {value}
        </Typography>
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
