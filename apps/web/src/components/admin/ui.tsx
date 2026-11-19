"use client";

/**
 * Small building blocks for the /admin page, from design-system parts and
 * design tokens: a titled section, a "couldn't load" notice, a table, a
 * bar and the uptime strip. No chart library (#244).
 */

import type { ReactNode } from "react";
import styled from "styled-components";
import { InlineAlert, Stack, Typography, tokens } from "@common-origin/design-system";

const color = tokens.semantic.color;

export function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} style={{ scrollMarginTop: 16 }}>
      <Stack direction="column" gap="md">
        <Stack direction="column" gap="xs">
          <h2 id={`${id}-title`} style={{ margin: 0 }}>
            <Typography variant="h2" as="span">
              {title}
            </Typography>
          </h2>
          {note && (
            <Typography variant="small" color="subdued">
              {note}
            </Typography>
          )}
        </Stack>
        {children}
      </Stack>
    </section>
  );
}

/** A section whose data couldn't be read: it says so and which migration to check, and the rest of the page carries on. */
export function NotLoaded({ hint }: { hint: string }) {
  return <InlineAlert variant="warning">{`Couldn't load (${hint})`}</InlineAlert>;
}

const Scroll = styled.div`
  overflow-x: auto;
`;

const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font: ${tokens.semantic.typography.small};
  color: ${color.text.default};

  th,
  td {
    text-align: left;
    padding: 6px 12px 6px 0;
    border-bottom: 1px solid ${color.border.default};
    vertical-align: top;
    white-space: nowrap;
  }

  th {
    font-weight: 600;
    color: ${color.text.muted};
  }

  td.num,
  th.num {
    text-align: right;
    padding-right: 16px;
    font-variant-numeric: tabular-nums;
  }

  td.wrap {
    white-space: normal;
    min-width: 200px;
  }

  tr[data-selected="true"] td {
    background: ${color.fill['accent-muted']};
  }
`;

export interface Column<Row> {
  header: string;
  render: (row: Row) => ReactNode;
  align?: "num" | "wrap";
}

export function DataTable<Row>({ caption, columns, rows, rowKey, selected }: { caption: string; columns: Column<Row>[]; rows: Row[]; rowKey: (row: Row) => string; selected?: (row: Row) => boolean }) {
  return (
    <Scroll>
      <StyledTable>
        <caption style={{ position: "absolute", left: -9999 }}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.header} className={column.align === "num" ? "num" : undefined} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} data-selected={selected?.(row) ? "true" : undefined}>
              {columns.map((column) => (
                <td key={column.header} className={column.align}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </StyledTable>
    </Scroll>
  );
}

const Track = styled.div`
  background: ${color.fill.muted};
  border-radius: ${tokens.semantic.radius.sm};
  height: 10px;
  overflow: hidden;
  min-width: 80px;
`;

const Fill = styled.div<{ $pct: number; $tone: "default" | "warning" | "danger" }>`
  height: 100%;
  width: ${(p) => Math.max(0, Math.min(100, p.$pct))}%;
  background: ${(p) => (p.$tone === "danger" ? color.fill.danger : p.$tone === "warning" ? color.fill.warning : color.fill.accent)};
`;

/** A horizontal bar for `value` out of `max`, with its text label for screen readers. */
export function Bar({ value, max, label, tone = "default" }: { value: number; max: number; label: string; tone?: "default" | "warning" | "danger" }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <Track role="img" aria-label={label} title={label}>
      <Fill $pct={pct} $tone={tone} />
    </Track>
  );
}

const Strip = styled.div`
  display: flex;
  gap: 1px;
  height: 28px;
  align-items: stretch;
`;

const Slot = styled.div<{ $state: "ok" | "failing" | "no_data" }>`
  flex: 1 1 0;
  min-width: 1px;
  border-radius: 1px;
  background: ${(p) => (p.$state === "ok" ? color.fill.success : p.$state === "failing" ? color.fill.danger : color.fill.muted)};
`;

/** One cell per 15-minute slot: ok, failing, or no data. Never colour alone: each cell carries its text in the tooltip, and the legend names the states. */
export function UptimeStrip({ slots }: { slots: { start: number; state: "ok" | "failing" | "no_data" }[] }) {
  if (slots.length === 0) return <Typography variant="small" color="subdued">No completed 15-minute slots in this range yet.</Typography>;
  return (
    <Stack direction="column" gap="xs">
      <Strip role="img" aria-label={`Uptime: ${slots.filter((s) => s.state === "ok").length} ok, ${slots.filter((s) => s.state === "failing").length} failing, ${slots.filter((s) => s.state === "no_data").length} no data, in ${slots.length} slots of 15 minutes`}>
        {slots.map((slot) => (
          <Slot key={slot.start} $state={slot.state} title={`${new Date(slot.start).toISOString().slice(0, 16).replace("T", " ")} UTC: ${slot.state === "no_data" ? "no data" : slot.state}`} />
        ))}
      </Strip>
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

const Details = styled.details`
  summary {
    cursor: pointer;
    font: ${tokens.semantic.typography.small};
    color: ${color.text.default};
    padding: 4px 0;
  }

  summary > span + span {
    color: ${color.text.muted};
    margin-left: 8px;
  }

  > div {
    margin-top: 12px;
  }
`;

/** Detail that most visits don't need: closed until opened, with a one-line summary of what's inside. */
export function Collapsible({ title, summary, children }: { title: string; summary?: string; children: ReactNode }) {
  return (
    <Details>
      <summary>
        <span>
          <strong>{title}</strong>
        </span>
        {summary && <span>{summary}</span>}
      </summary>
      <div>{children}</div>
    </Details>
  );
}

const TileLink = styled.a<{ $tone: "ok" | "warning" | "bad" | "neutral" }>`
  display: block;
  flex: 1 1 140px;
  min-width: 0;
  padding: 12px 16px;
  text-decoration: none;
  color: inherit;
  background: ${color.fill.muted};
  border-radius: ${tokens.semantic.radius.sm};
  border-top: 4px solid ${(p) => (p.$tone === "ok" ? color.fill.success : p.$tone === "warning" ? color.fill.warning : p.$tone === "bad" ? color.fill.danger : color.border.default)};

  &:hover,
  &:focus-visible {
    background: ${color.fill["accent-muted"]};
  }
`;

/** A headline number that links to its section. The tone is shown as a top border and never alone: the value and note say the same in words. */
export function Tile({ label, value, note, tone, href }: { label: string; value: string; note: string; tone: "ok" | "warning" | "bad" | "neutral"; href: string }) {
  return (
    <TileLink href={href} $tone={tone}>
      <Stat label={label} value={value} note={note} />
    </TileLink>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <Typography variant="body" color="subdued">
      {children}
    </Typography>
  );
}
