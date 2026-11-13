"use client";

import { Children, Fragment, type ReactNode } from "react";
import styled from "styled-components";
import { Box, Divider, Stack, Typography, tokens } from "@common-origin/design-system";

interface SettingsSectionProps {
  title: string;
  /** What the section is for: shown under the title, in the left column. */
  description: ReactNode;
  /** The section's inputs, in the right column. */
  children: ReactNode;
}

/**
 * The card's padding (#196): 16px on phones, 32px from the design system's
 * `md` breakpoint up. Box's `p` can't vary by breakpoint, so it lives here.
 */
const FormPadding = styled.div`
  padding: ${tokens.semantic.space[400]};

  @media (min-width: ${tokens.semantic.breakpoint.md}) {
    padding: ${tokens.semantic.space[800]};
  }
`;

/**
 * The one card holding every /settings section (#196), with a divider
 * between each pair of sections.
 */
export function SettingsForm({ children }: { children: ReactNode }) {
  const sections = Children.toArray(children);
  return (
    <Box borderRadius="lg" bg="surface.raised">
      <FormPadding>
        <Stack direction="column" gap="xl">
          {sections.map((section, index) => (
            <Fragment key={index}>
              {index > 0 && <Divider size="small" />}
              {section}
            </Fragment>
          ))}
        </Stack>
      </FormPadding>
    </Box>
  );
}

/**
 * A section's two columns (#196): title and description, then inputs, 2 : 3
 * with 64px between them from the `md` breakpoint up; stacked below it. Not
 * the design system's Grid, which puts its gap between every one of its
 * columns, so an uneven split would multiply the gap.
 */
const SectionColumns = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  row-gap: ${tokens.semantic.space[400]};

  /* Grid items default to min-width: auto and won't shrink below their content (a long email). */
  & > * {
    min-width: 0;
  }

  @media (min-width: ${tokens.semantic.breakpoint.md}) {
    grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
    column-gap: ${tokens.semantic.space[1600]};
  }
`;

/**
 * One section of /settings (#196): title and description on the left, the
 * inputs on the right, stacking into one column (title first) below the
 * design system's `md` breakpoint. Sits inside SettingsForm, which draws
 * the card and the dividers.
 */
export default function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <Box as="section" aria-label={title}>
      <SectionColumns>
        <Stack direction="column" gap="sm">
          <Typography variant="h4" as="h2">{title}</Typography>
          <Typography variant="small" color="subdued">
            {description}
          </Typography>
        </Stack>
        <div>{children}</div>
      </SectionColumns>
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
