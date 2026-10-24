"use client";

import styled, { css } from "styled-components";
import { tokens } from "@common-origin/design-system";
import type { ReactNode } from "react";

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
const space = tokens.semantic.spacing.layout;
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
    background: ${color.background.default};
    border: ${tokens.semantic.border.default};
    &:hover {
      border-color: ${color.border.strong};
    }
  `,
  // An open slot on the page, so secondary buttons (surface grey) still stand out
  empty: css`
    background: ${color.background.transparent};
    border: ${tokens.semantic.border.width.thick} dashed ${color.border.default};
  `,
  proposal: css`
    background: ${color.background.subtle};
    border: ${tokens.semantic.border.width.thin} solid ${color.border.interactive};
  `,
};

const Frame = styled.article<{ $layout: DayCardLayout; $tone: DayCardTone }>`
  /* Positioned, so a meal title's link can stretch over the whole card */
  position: relative;
  display: grid;
  column-gap: ${space.md};
  row-gap: ${space.sm};
  padding: ${space.md} ${space.sm} ${space.lg} ${space.lg};
  border-radius: ${tokens.semantic.border.radius.lg};
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
    padding: ${space.lg} ${space.lg} ${space.lg} ${space.xs};
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
  color: ${color.text.subdued};

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
    padding-right: ${space.sm};
  }
`;

const Actions = styled.div<{ $layout: DayCardLayout }>`
  grid-area: actions;
  display: flex;
  align-items: center;
  gap: ${space.xs};
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
        padding-right: ${space.sm};
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
