"use client";

import { Box, Grid, GridCol, Typography } from "@common-origin/design-system";
import type { ReactNode } from "react";

/**
 * One night of the plan list (#38): the day's name in a narrow left column
 * from the design system's sm breakpoint up, and above the meal on phones.
 */
export default function DayRow({ day, children }: { day: string; children: ReactNode }) {
  return (
    <Grid cols={12} gapX="4" gapY="2">
      <GridCol span={12} spanSm={2}>
        <Box pt="sm">
          <Typography variant="label">{day}</Typography>
        </Box>
      </GridCol>
      <GridCol span={12} spanSm={10}>
        {children}
      </GridCol>
    </Grid>
  );
}
