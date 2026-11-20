"use client";

import { useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Dropdown, IconButton, InputChip, Stack, Typography } from "@common-origin/design-system";
import { ago, RANGES, RANGE_WORDS, utcStamp } from "@/lib/admin/format";
import type { Range } from "@/lib/admin/types";

// A clock every header shares: the real time, refreshed every 30 seconds while something is listening.
const clock = { now: 0, listeners: new Set<() => void>(), timer: undefined as ReturnType<typeof setInterval> | undefined };
function tick() {
  clock.now = Date.now();
  clock.listeners.forEach((listener) => listener());
}
function subscribeClock(listener: () => void) {
  clock.listeners.add(listener);
  if (clock.listeners.size === 1) clock.timer = setInterval(tick, 30_000);
  tick(); // the real time as soon as the browser is listening
  return () => {
    clock.listeners.delete(listener);
    if (clock.listeners.size === 0) clearInterval(clock.timer);
  };
}

/**
 * The time to measure "Updated … ago" against: real time, but never earlier
 * than the data's own load time (a Refresh brings a newer one). Hydration
 * renders with the server snapshot (0, so the load time), which matches the
 * server's HTML; React then re-reads the real time at once, so data served from
 * a cache hours later reads its true age instead of "just now".
 */
function useClock(loadedAt: string): Date {
  const now = useSyncExternalStore(subscribeClock, () => clock.now, () => 0);
  return new Date(Math.max(new Date(loadedAt).getTime(), now));
}

/**
 * The page header (#282): the title on the left; on the right when the data
 * was loaded (with the exact UTC time in the same line), a Refresh button and the time
 * range. The household filter, when there is one, is a removable chip.
 * The first render reads the same on the server and in the browser (see
 * useClock), so the clock never causes a hydration mismatch.
 */
export function PageHeader({ range, household, generatedAt, menu }: { range: Range; household: string | null; generatedAt: string; menu?: { onOpen: () => void } }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const clock = useClock(generatedAt);
  const query = (next: Range, short: string | null) => `/admin?range=${next}${short ? `&household=${short}` : ""}`;
  return (
    <Stack direction="column" gap="sm">
      <Stack direction="row" gap="md" alignItems="center" justifyContent="space-between" wrap>
        <Stack direction="row" gap="sm" alignItems="center">
          {menu && <IconButton variant="secondary" iconName="menu" aria-label="Sections" onClick={menu.onOpen} />}
          <Typography variant="h1">Admin</Typography>
        </Stack>
        <Stack direction="row" gap="md" alignItems="flex-end" wrap>
          {/* Visible text, not a tooltip: a hover hint needs a focusable trigger (a tab stop with no name) and can't open on touch. */}
          <Typography variant="small" color="subdued">
            {`Updated ${ago(generatedAt, clock)} (loaded ${utcStamp(generatedAt)})`}
          </Typography>
          <Button variant="secondary" size="small" iconName="refresh" disabled={refreshing} onClick={() => startRefresh(() => router.refresh())}>
            {refreshing ? "Refreshing" : "Refresh"}
          </Button>
          <Dropdown
            label="Time range"
            options={RANGES.map((value) => ({ id: value, label: `Last ${RANGE_WORDS[value]}` }))}
            value={range}
            onChange={(value) => router.push(query(value as Range, household))}
          />
        </Stack>
      </Stack>
      {household && (
        <Stack direction="row" gap="sm">
          <InputChip selected aria-label={`Household ${household}: remove the filter`} onDismiss={() => router.push(query(range, null))}>
            {`Household ${household}`}
          </InputChip>
        </Stack>
      )}
    </Stack>
  );
}
