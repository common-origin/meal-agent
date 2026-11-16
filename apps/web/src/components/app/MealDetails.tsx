"use client";

import { Children, type ReactNode } from "react";
import styled from "styled-components";
import { Icon, Tag, Typography, tokens } from "@common-origin/design-system";
import { isLongCook } from "@/lib/dayCard";
import type { NutritionInfo } from "@/lib/types/recipe";

export type MealDetailsProps = {
  /** Minutes; 0 or less means unknown, and no time is shown (#181). */
  timeMins: number;
  nutrition?: NutritionInfo;
  /** Where the recipe is from ("AI generated", a chef); omitted when unknown. */
  source?: string;
  /** More tags at the end of the line, after calories and protein (the plan's tags). */
  children?: ReactNode;
};

const Time = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${tokens.semantic.space[100]};
  vertical-align: middle;
`;

// The source stays whole ("AI generated" never splits across lines)
const Item = styled.span`
  white-space: nowrap;
`;

// The tags (calories, protein, then the plan's tags), after the text on the same line. The space
// before them is a plain text space in the markup, not a margin, so it drops away if the tags wrap
// onto their own line instead of indenting them.
const Extras = styled.span`
  display: inline-flex;
  flex-wrap: wrap;
  gap: ${tokens.semantic.space[100]};
  vertical-align: middle;
`;

/**
 * A meal's details line, shared by the plan's day cards and the recipe cards
 * (#160, #181): cook time first with the clock (warning colour and "long cook"
 * over an hour), then the source, then calories and protein as tags (like the
 * plan header's figures), then any tags passed in.
 */
export default function MealDetails({ timeMins, nutrition, source, children }: MealDetailsProps) {
  const hasTime = timeMins > 0;
  const long = hasTime && isLongCook(timeMins);
  // Zero means unknown (as in planSummary.ts), so it gets no tag rather than "0 cal"
  const calories = nutrition && nutrition.calories > 0 ? nutrition.calories : null;
  const protein = nutrition && nutrition.protein > 0 ? nutrition.protein : null;
  // Counts the items, so an empty list of tags (PlanMeal passes an array) adds nothing
  const hasTags = calories !== null || protein !== null || Children.count(children) > 0;

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
      {source && (
        <>
          {/* The "·" is glued to the time; the line may break only after it */}
          {hasTime ? " · " : ""}
          <Item>{source}</Item>
        </>
      )}
      {hasTags && (
        <>
          {hasTime || source ? " " : ""}
          <Extras>
            {calories !== null && (
              <Tag size="small" data-testid="meal-calories">{`${calories} cal`}</Tag>
            )}
            {protein !== null && (
              <Tag size="small" data-testid="meal-protein">{`${protein}g protein`}</Tag>
            )}
            {children}
          </Extras>
        </>
      )}
    </Typography>
  );
}
