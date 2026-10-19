"use client";

import styled from "styled-components";
import { Typography } from "@common-origin/design-system";
import { tokens } from "@common-origin/design-system";
import type { ReactNode } from "react";

// The day's name in a left column on wider screens, above the meal on phones (#38).
const Row = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tokens.semantic.spacing.layout.xs};
  align-items: start;

  @media (min-width: 640px) {
    grid-template-columns: 112px minmax(0, 1fr);
    gap: ${tokens.semantic.spacing.layout.md};
  }
`;

const DayLabel = styled.div`
  @media (min-width: 640px) {
    padding-top: ${tokens.semantic.spacing.layout.md};
  }
`;

/** One night of the plan list: the day's name and whatever that night shows. */
export default function DayRow({ day, children }: { day: string; children: ReactNode }) {
  return (
    <Row>
      <DayLabel>
        <Typography variant="label">{day}</Typography>
      </DayLabel>
      <div>{children}</div>
    </Row>
  );
}
