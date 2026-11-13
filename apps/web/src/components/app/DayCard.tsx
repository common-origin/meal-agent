"use client";

import styled, { css } from "styled-components";
import { Stack, Typography, tokens } from "@common-origin/design-system";
import type { ReactNode } from "react";
import { Bone, KebabMark } from "./skeleton";

/**
 * - `meal`: a filled or proposed night. On phones, the day and the actions share the top line.
 * - `empty`: on phones, the body sits beside the day and the actions span the card below.
 * - `stacked`: an error. On phones, the day, the body and the actions each get a line.
 */
export type DayCardLayout = "meal" | "empty" | "stacked";
export type DayCardTone = "filled" | "empty" | "proposal";

export type DayCardProps = {
  day: string;
  /** "27 Oct" */
  date?: string;
  layout?: DayCardLayout;
  tone?: DayCardTone;
  /** Left of the day, from `sm` up: the drag grip. */
  lead?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

const color = tokens.semantic.color;
const space = tokens.semantic.space;
const sm = tokens.base.breakpoint.sm;
const phone = `@media (max-width: calc(${sm} - 0.02px))`;
const fromSm = `@media (min-width: ${sm})`;

const PHONE_GRID: Record<DayCardLayout, ReturnType<typeof css>> = {
  meal: css`
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas: "day actions" "body body";
    align-items: center;
  `,
  empty: css`
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-areas: "day body" "actions actions";
    align-items: baseline;
  `,
  stacked: css`
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: "day" "body" "actions";
  `,
};

const TONE: Record<DayCardTone, ReturnType<typeof css>> = {
  filled: css`
    background: ${tokens.semantic.surface.raised};
    border: ${tokens.semantic.border.default};
    &:hover {
      border-color: ${color.border["input-hover"]};
    }
  `,
  // An open slot on the page, so secondary buttons (surface grey) still stand out
  empty: css`
    background: ${color.fill.none};
    border: ${tokens.semantic.border.width.thick} dashed ${color.border.default};
  `,
  proposal: css`
    background: ${tokens.semantic.surface.raised};
    border: ${tokens.semantic.border.width.thin} solid ${color.border.accent};
  `,
};

const Frame = styled.article<{ $layout: DayCardLayout; $tone: DayCardTone }>`
  /* Positioned, so a meal title's link can stretch over the whole card */
  position: relative;
  display: grid;
  column-gap: ${space[300]};
  row-gap: ${space[200]};
  padding: ${space[300]} ${space[200]} ${space[400]} ${space[400]};
  border-radius: ${tokens.semantic.radius.lg};
  ${({ $tone }) => TONE[$tone]}

  ${phone} {
    ${({ $layout }) => PHONE_GRID[$layout]}
    /* Touch targets: at least 44px on phones */
    & button {
      min-height: 44px;
      min-width: 44px;
    }
  }

  ${fromSm} {
    grid-template-columns: 1.75rem 7rem minmax(0, 1fr) auto;
    grid-template-areas: "lead day body actions";
    /* The day and the body's first line share a baseline */
    align-items: baseline;
    /* Right is the top padding less the actions' -0.375rem lift (below), so the buttons sit
       as far from the right edge as from the top */
    padding: ${space[400]} calc(${space[400]} - 0.375rem) ${space[400]} ${space[100]};
  }
`;

const Lead = styled.div`
  grid-area: lead;
  align-self: start;
  /* Above a stretched title link, so the grip gets the press */
  position: relative;
  z-index: 1;
  /* Centres a 40px control on the 28px first line */
  margin-top: -0.375rem;
  ${phone} {
    display: none;
  }
`;

const Day = styled.p`
  grid-area: day;
  margin: 0;
  color: ${color.text.default};
  font: ${tokens.semantic.typography.label};

  ${fromSm} {
    font-weight: 700;
    font-size: 1.125rem;
    /* The meal title's (h5) line height */
    line-height: 1.75rem;
  }
`;

const DateText = styled.span`
  font: ${tokens.semantic.typography.small};
  color: ${color.text.muted};

  ${phone} {
    &::before {
      content: " · ";
    }
  }
  ${fromSm} {
    display: block;
  }
`;

const Body = styled.div`
  grid-area: body;
  min-width: 0;
  ${phone} {
    /* The card's right padding is tight for the ⋮ button; text keeps the full gutter */
    padding-right: ${space[200]};
  }
`;

const Actions = styled.div<{ $layout: DayCardLayout }>`
  grid-area: actions;
  display: flex;
  align-items: center;
  gap: ${space[100]};
  /* Above a stretched title link */
  position: relative;
  z-index: 1;
  /* An open ⋮ menu also clears the next cards' actions */
  &:has([aria-expanded="true"]) {
    z-index: 2;
  }

  ${phone} {
    ${({ $layout }) =>
      $layout !== "meal" &&
      css`
        flex-wrap: wrap;
        padding-right: ${space[200]};
        & > * {
          flex: 1 1 0;
        }
      `}
  }
  ${fromSm} {
    align-self: start;
    margin-top: -0.375rem;
  }
`;

/**
 * One night of the plan (#160): the day and date inside the card, in a left
 * column from the `sm` breakpoint and on the top line on phones, with the
 * same frame for every state so the day always lands in the same place.
 */
export default function DayCard({ day, date, layout = "meal", tone = "filled", lead, actions, children }: DayCardProps) {
  return (
    <Frame $layout={layout} $tone={tone} aria-label={date ? `${day} ${date}` : day}>
      <Lead>{lead}</Lead>
      <Day>
        <span>{day}</span>
        {date && <DateText>{date}</DateText>}
      </Day>
      <Body>{children}</Body>
      {actions && <Actions $layout={layout}>{actions}</Actions>}
    </Frame>
  );
}

// Loading (#177): a skeleton that mirrors PlanMeal inside the same frame, so
// a night keeps its height, its day and its actions while it loads.

/** A secondary Button's footprint (the "Change" button): 40px tall, 44px on phones like the real one. */
const ButtonBone = styled(Bone)`
  display: block;
  height: 2.5rem;
  ${phone} {
    height: 44px;
  }
`;

/** A naked IconButton (⋮): no fill, just a thin mark where its icon will be. */
const IconButtonBone = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  ${phone} {
    width: 44px;
    height: 44px;
  }
`;

/**
 * A loading meal: bars on the title's and the details line's own type (h5 and
 * label), so each line has PlanMeal's height and a text baseline the day aligns
 * with. Announced as a status with `label`.
 */
export function MealSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} data-testid="meal-skeleton">
      {/* What the live region announces: its label alone isn't read out */}
      <span className="sr-only">{label}</span>
      <Stack direction="column" gap="sm">
        <Typography variant="h5" as="div">
          <Bone $width="60%" />
        </Typography>
        <Typography variant="label" as="div">
          <Bone $width="40%" />
        </Typography>
      </Stack>
    </div>
  );
}

/** Placeholders where a loaded meal's Change and ⋮ will be. */
export function MealActionsSkeleton({ withChange }: { withChange: boolean }) {
  return (
    <>
      {withChange && <ButtonBone $width="5rem" aria-hidden="true" data-testid="action-placeholder" />}
      <IconButtonBone aria-hidden="true" data-testid="action-placeholder">
        <KebabMark $width="0.25rem" />
      </IconButtonBone>
    </>
  );
}

