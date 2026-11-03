"use client";

import { Fragment, type ReactNode } from "react";
import styled from "styled-components";
import { Icon, Typography, tokens } from "@common-origin/design-system";
import { isLongCook } from "@/lib/dayCard";
import type { NutritionInfo } from "@/lib/types/recipe";

export type MealDetailsProps = {
  /** Minutes; 0 or less means unknown, and no time is shown (#181). */
  timeMins: number;
  nutrition?: NutritionInfo;
  /** Where the recipe is from ("AI generated", a chef); omitted when unknown. */
  source?: string;
  /** More inline items at the end of the line (the plan's tags). */
  children?: ReactNode;
};

const Time = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${tokens.semantic.space[100]};
  vertical-align: middle;
`;

// Each item stays whole ("AI generated" never splits across lines)
const Item = styled.span`
  white-space: nowrap;
`;

// The plan's tags, after the text on the same line
const Extras = styled.span`
  display: inline-flex;
  flex-wrap: wrap;
  gap: ${tokens.semantic.space[100]};
  margin-left: ${tokens.semantic.space[200]};
  vertical-align: middle;
`;

/**
 * A meal's details line, shared by the plan's day cards and the recipe cards
 * (#160, #181): cook time first with the clock (warning colour and "long cook"
 * over an hour), then calories and protein, then the source.
 */
export default function MealDetails({ timeMins, nutrition, source, children }: MealDetailsProps) {
  const hasTime = timeMins > 0;
  const long = hasTime && isLongCook(timeMins);
  // The muted items, each after a "·" (the first only if a time precedes it)
  const rest = [nutrition ? `${nutrition.calories} cal · ${nutrition.protein}g protein` : null, source || null].filter(
    (item): item is string => Boolean(item)
  );

  return (
    // Flows as text, each "·" glued to the item before it, so a wrapped line starts with a word
    <Typography variant="small" color="subdued" as="div">
      {hasTime && (
        <Time>
          <Icon name="statusPending" size="sm" iconColor={long ? "warning" : "default"} />
          <Typography variant="label" as="span" color={long ? "warning" : "default"}>
            {long ? `${timeMins} min · long cook` : `${timeMins} min`}
          </Typography>
        </Time>
      )}
      {rest.map((item, i) => (
        <Fragment key={item}>
          {/* The "·" is glued to what's before it; the line may break only after it */}
          {hasTime || i > 0 ? "\u00a0· " : ""}
          <Item>{item}</Item>
        </Fragment>
      ))}
      {children && <Extras>{children}</Extras>}
    </Typography>
  );
}
