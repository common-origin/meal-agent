"use client";

import { useState } from "react";
import Link from "next/link";
import styled, { keyframes } from "styled-components";
import { Chip, Stack, Typography, tokens } from "@common-origin/design-system";
import type { MealCardProps } from "./MealCard";
import MealDetails from "./MealDetails";
import { stretchedControl } from "./stretchedControl";

export type PlanMealProps = MealCardProps & {
  /** The tags to show: the meal's reason tags less any the whole week shares (#160). */
  tags: string[];
  /** Fade in: this meal is replacing its loading skeleton (#177). Read once, when it mounts. */
  fadeIn?: boolean;
};

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

// When a meal replaces its skeleton it fades in rather than popping (#177)
const FadeIn = styled.div<{ $animate: boolean }>`
  animation: ${({ $animate }) => ($animate ? fadeIn : "none")} ${tokens.semantic.motion.duration.moderate} ${tokens.semantic.motion.easing.decelerate};
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

// The title is the card's link, stretched over the card (DayCard is positioned)
const TitleLink = styled(Link)`
  ${stretchedControl}
`;

/** A planned meal inside its DayCard (#160): the title, then cook time first in the details line. */
export default function PlanMeal({ recipeId, title, chef, timeMins, explanation, nutrition, conflicts = [], tags, disableLink, fadeIn: fadeInProp = false }: PlanMealProps) {
  // Latched at mount: a later render (other nights resolving) can't restart or cut short the fade
  const [animate] = useState(fadeInProp);
  // Shown as stored, like the recipe page (#181)
  const name = title;

  return (
    <FadeIn $animate={animate} data-fade-in={animate || undefined}>
      <Stack direction="column" gap="sm">
        <Typography variant="h5" as="h3">
          {disableLink ? name : <TitleLink href={`/recipe/${recipeId}`}>{name}</TitleLink>}
        </Typography>
        {explanation && (
          <Typography variant="small" color="subdued">
            {explanation}
          </Typography>
        )}
        <MealDetails timeMins={timeMins} nutrition={nutrition} source={chef}>
          {tags.map((tag) => (
            <Chip key={tag} variant="default">
              {tag}
            </Chip>
          ))}
        </MealDetails>
        {conflicts.length > 0 && (
          <Typography variant="small" color="warning">
            Conflicts: {conflicts.join(", ")}
          </Typography>
        )}
      </Stack>
    </FadeIn>
  );
}
