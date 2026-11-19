"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, Dropdown, IconButton, InputChip, Stack, Tooltip, Typography } from "@common-origin/design-system";
import { ago, RANGES, RANGE_WORDS, utcStamp } from "@/lib/admin/format";
import type { Range } from "@/lib/admin/types";

/** A clock that follows real time, but never reads earlier than the data's own load time (a Refresh brings a newer one). */
function useClock(loadedAt: string): Date {
  const loaded = new Date(loadedAt);
  const [tick, setTick] = useState<Date | null>(null);
  useEffect(() => {
    const id = setInterval(() => setTick(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return tick && tick > loaded ? tick : loaded;
}

/**
 * The page header (#282): the title on the left; on the right when the data
 * was loaded (the exact time in a tooltip), a Refresh button and the time
 * range. The household filter, when there is one, is a removable chip.
 * The first render reads "just now" on the server and the browser alike, so
 * the clock ticking on never causes a hydration mismatch.
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
          <Tooltip text={`Loaded ${utcStamp(generatedAt)}`} kind="description" side="bottom">
            <Box tabIndex={0}>
              <Typography variant="small" color="subdued">
                {`Updated ${ago(generatedAt, clock)}`}
              </Typography>
            </Box>
          </Tooltip>
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
