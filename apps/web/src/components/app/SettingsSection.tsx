"use client";

import type { ReactNode } from "react";
import { Box, Grid, GridCol, Stack, Typography } from "@common-origin/design-system";

interface SettingsSectionProps {
  title: string;
  /** What the section is for: shown under the title, in the left column. */
  description: ReactNode;
  /** The section's inputs, in the right column. */
  children: ReactNode;
}

/**
 * One section of /settings (#196): title and description on the left, the
 * inputs on the right, stacking into one column (title first) below the
 * design system's `md` breakpoint.
 */
export default function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <Box as="section" border="default" borderRadius="lg" p="lg" bg="surface.raised" aria-label={title}>
      <Grid cols={3} gapX="8" gapY="4">
        <GridCol span={3} spanMd={1}>
          <Stack direction="column" gap="sm">
            <Typography variant="h4" as="h2">{title}</Typography>
            <Typography variant="small" color="subdued">
              {description}
            </Typography>
          </Stack>
        </GridCol>
        <GridCol span={3} spanMd={2}>
          {children}
        </GridCol>
      </Grid>
    </Box>
  );
}
