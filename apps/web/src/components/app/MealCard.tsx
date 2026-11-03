"use client";

import styled from "styled-components";
import Link from "next/link";
import { Chip, Stack, Typography, tokens } from "@common-origin/design-system";
import { explainReasons } from "@/lib/explainer";
import type { NutritionInfo } from "@/lib/types/recipe";
import MealDetails from "./MealDetails";
import MealMenu from "./MealMenu";
import { Bone, ChipBone, KebabMark } from "./skeleton";
import { stretchedControl } from "./stretchedControl";

export type MealCardProps = {
  recipeId: string;
  title: string;
  /** Where the recipe is from, shown in the details line; empty when unknown. */
  chef: string;
  /** Minutes; 0 or less means unknown (no time is shown). */
  timeMins: number;
  conflicts?: string[];
  reasons?: string[];
  /** One line on why the AI chose this meal for this household this week (#94). */
  explanation?: string;
  nutrition?: NutritionInfo;
  /** In the ⋮ menu, "Use a saved recipe"; in SwapDrawer, picking the card. */
  onSwapClick?: () => void;
  onDeleteClick?: () => void;
  /** The ⋮ menu's destructive item, e.g. "Delete recipe" on /recipes (#179). */
  deleteLabel?: string;
  disableLink?: boolean; // When true, the card picks the recipe (SwapDrawer) instead of opening it
};

const space = tokens.semantic.space;

// Positioned, so the title's control stretches over the whole card (#180)
const Card = styled.article`
  position: relative;
  box-sizing: border-box;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: ${space[200]};
  padding: ${space[400]} ${space[300]} ${space[400]} ${space[400]};
  border: ${tokens.semantic.border.default};
  border-radius: ${tokens.semantic.radius.lg};
  background: ${tokens.semantic.surface.raised};
  transition: border-color ${tokens.semantic.motion.duration.fast} ${tokens.semantic.motion.easing.decelerate};
  &:hover {
    border-color: ${tokens.semantic.color.border["input-hover"]};
  }
`;

// Two lines at most, then an ellipsis (#181)
const Clamp = styled.span`
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const TitleLink = styled(Link)`
  ${stretchedControl}
`;

const TitleButton = styled.button`
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  text-align: left;
  cursor: pointer;
  ${stretchedControl}
`;

// Above the stretched title control; centres the 40px ⋮ on the title's first line
const MenuSlot = styled.div`
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  margin-top: -0.375rem;
  /* Touch target: 44px on phones, as on the plan's cards */
  @media (max-width: calc(${tokens.base.breakpoint.sm} - 0.02px)) {
    margin-top: -0.5rem;
    & button {
      min-width: 44px;
      min-height: 44px;
    }
  }
`;

// Where ⋮ will be in a loading card: its 40px footprint around the icon's mark
const MenuMark = styled(MenuSlot)`
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
`;

// Anchored to the bottom, so a row of cards lines its chips up
const Chips = styled.div`
  margin-top: auto;
  padding-top: ${space[100]};
`;

/**
 * A recipe as a card, for the recipe library and the swap drawer (#180, #181):
 * the title is the card's control (a link, or in the swap drawer a button that
 * picks it), stretched over the card, with ⋮ above it; then the details line and
 * the reason chips. The plan's nights use PlanMeal, which shares the details line.
 */
export default function MealCard({
  recipeId,
  title,
  chef,
  timeMins,
  conflicts = [],
  reasons = [],
  explanation,
  nutrition,
  onSwapClick,
  onDeleteClick,
  deleteLabel,
  disableLink = false,
}: MealCardProps) {
  const chipLabels = explainReasons(reasons, title, 3).map((chip) => chip.text);
  const control = disableLink ? (
    onSwapClick ? (
      <TitleButton type="button" onClick={onSwapClick} aria-label={`Use ${title}`}>
        {title}
      </TitleButton>
    ) : (
      title
    )
  ) : (
    <TitleLink href={`/recipe/${recipeId}`}>{title}</TitleLink>
  );

  return (
    <Card>
      <Stack direction="row" gap="sm" alignItems="flex-start">
        <div style={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h5" as="h3">
            <Clamp>{control}</Clamp>
          </Typography>
        </div>
        <MenuSlot>
          <MealMenu
            recipeId={recipeId}
            title={title}
            onSwapClick={disableLink ? undefined : onSwapClick}
            onDeleteClick={onDeleteClick}
            deleteLabel={deleteLabel}
          />
        </MenuSlot>
      </Stack>

      {explanation && (
        <Typography variant="small" color="subdued">
          {explanation}
        </Typography>
      )}

      <MealDetails timeMins={timeMins} nutrition={nutrition} source={chef} />

      {conflicts.length > 0 && (
        <Typography variant="small" color="warning">
          Conflicts: {conflicts.join(", ")}
        </Typography>
      )}

      {chipLabels.length > 0 && (
        <Chips>
          <Stack direction="row" gap="xs" wrap>
            {chipLabels.map((label) => (
              <Chip key={label} variant="default">
                {label}
              </Chip>
            ))}
          </Stack>
        </Chips>
      )}
    </Card>
  );
}

/**
 * A loading recipe card (#181), mirroring MealCard: two title lines, the
 * details line and two chips, with ⋮'s mark. Decorative: the grid around it
 * carries the status and its label.
 */
export function MealCardSkeleton() {
  return (
    <Card as="div" aria-hidden="true" data-testid="meal-card-skeleton">
      <Stack direction="row" gap="sm" alignItems="flex-start">
        <div style={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h5" as="div">
            <Bone $width="90%" />
          </Typography>
          <Typography variant="h5" as="div">
            <Bone $width="55%" />
          </Typography>
        </div>
        <MenuMark>
          <KebabMark $width="0.25rem" />
        </MenuMark>
      </Stack>
      <Typography variant="label" as="div">
        <Bone $width="55%" />
      </Typography>
      <Chips>
        <Stack direction="row" gap="xs">
          <ChipBone $width="4rem" />
          <ChipBone $width="5.25rem" />
        </Stack>
      </Chips>
    </Card>
  );
}
