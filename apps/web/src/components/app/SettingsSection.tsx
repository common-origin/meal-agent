"use client";

import { Children, Fragment, type ReactNode } from "react";
import { Box, Divider, Grid, GridCol, Stack, Typography } from "@common-origin/design-system";

interface SettingsSectionProps {
  title: string;
  /** What the section is for: shown under the title, in the left column. */
  description: ReactNode;
  /** The section's inputs, in the right column. */
  children: ReactNode;
}

/**
 * The one card holding every /settings section (#196), with a divider
 * between each pair of sections.
 */
export function SettingsForm({ children }: { children: ReactNode }) {
  const sections = Children.toArray(children);
  return (
    <Box borderRadius="lg" p="lg" bg="surface.raised">
      <Stack direction="column" gap="xl">
        {sections.map((section, index) => (
          <Fragment key={index}>
            {index > 0 && <Divider size="small" />}
            {section}
          </Fragment>
        ))}
      </Stack>
    </Box>
  );
}

/**
 * One section of /settings (#196): title and description on the left, the
 * inputs on the right, stacking into one column (title first) below the
 * design system's `md` breakpoint. Sits inside SettingsForm, which draws
 * the card and the dividers.
 */
export default function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <Box as="section" aria-label={title}>
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

/**
 * Caps a text field, dropdown or number input at 540px (#196), so fields
 * don't stretch across a wide inputs column. Sliders, checkboxes and lists
 * keep the column's full width.
 */
export function SettingsField({ children }: { children: ReactNode }) {
  return (
    <Box maxWidth="540px" style={{ width: '100%' }}>
      {children}
    </Box>
  );
}
