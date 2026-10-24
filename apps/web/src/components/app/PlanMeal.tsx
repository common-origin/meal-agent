"use client";

import Link from "next/link";
import styled from "styled-components";
import { Chip, Icon, Stack, Typography, tokens } from "@common-origin/design-system";
import { isLongCook } from "@/lib/dayCard";
import { toSentenceCase, type MealCardProps } from "./MealCard";

export type PlanMealProps = MealCardProps & {
  /** The tags to show: the meal's reason tags less any the whole week shares (#160). */
  tags: string[];
};

// The title is the card's link, stretched over the card (DayCard is positioned)
const TitleLink = styled(Link)`
  color: inherit;
  text-decoration: none;
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: ${tokens.semantic.border.radius.lg};
  }
  &:focus-visible {
    outline: none;
  }
  &:focus-visible::after {
    outline: ${tokens.semantic.border.focus};
    outline-offset: ${tokens.semantic.border.focusOffset};
  }
`;

/** A planned meal inside its DayCard (#160): the title, then cook time first in the details line. */
export default function PlanMeal({ recipeId, title, chef, timeMins, explanation, nutrition, conflicts = [], tags, disableLink }: PlanMealProps) {
  const long = isLongCook(timeMins);
  const name = toSentenceCase(title);

  return (
    <Stack direction="column" gap="sm">
      <Typography variant="h5" as="h3">
        {disableLink ? name : <TitleLink href={`/recipe/${recipeId}`}>{name}</TitleLink>}
      </Typography>
      {explanation && (
        <Typography variant="small" color="subdued">
          {explanation}
        </Typography>
      )}
      <Stack direction="row" gap="sm" alignItems="center" wrap>
        <Stack direction="row" gap="xs" alignItems="center">
          <Icon name="statusPending" size="sm" iconColor={long ? "warning" : "default"} />
          <Typography variant="label" color={long ? "warning" : "default"}>
            {long ? `${timeMins} min · long cook` : `${timeMins} min`}
          </Typography>
        </Stack>
        {nutrition && (
          <Typography variant="small" color="subdued">
            · {nutrition.calories} cal · {nutrition.protein}g protein
          </Typography>
        )}
        {chef && (
          <Typography variant="small" color="subdued">
            · {chef}
          </Typography>
        )}
        {tags.map((tag) => (
          <Chip key={tag} variant="default">
            {tag}
          </Chip>
        ))}
      </Stack>
      {conflicts.length > 0 && (
        <Typography variant="small" color="warning">
          Conflicts: {conflicts.join(", ")}
        </Typography>
      )}
    </Stack>
  );
}
