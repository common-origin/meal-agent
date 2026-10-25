"use client";

import styled from "styled-components";
import Link from "next/link";
import { Chip, Stack, Typography, Box, ChipGroup, Tag } from "@common-origin/design-system";
import { tokens } from "@common-origin/design-system";
import { explainReasons } from "@/lib/explainer";
import type { NutritionInfo } from "@/lib/types/recipe";
import MealMenu from "./MealMenu";

// Convert title to sentence case while preserving proper nouns
export function toSentenceCase(str: string): string {
  if (!str) return str;
  
  // Words that should remain capitalized (cuisine names, regions, proper nouns)
  const properNouns = new Set([
    'thai', 'indian', 'mexican', 'italian', 'chinese', 'japanese', 'korean',
    'vietnamese', 'mediterranean', 'french', 'spanish', 'greek', 'moroccan',
    'middle eastern', 'asian', 'european', 'american', 'cajun', 'creole',
    'tuscan', 'sicilian', 'neapolitan', 'australian'
  ]);
  
  const words = str.split(' ');
  const result = words.map((word, index) => {
    const lowerWord = word.toLowerCase();
    
    // First word is always capitalized
    if (index === 0) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
    
    // Preserve capitalization of proper nouns
    if (properNouns.has(lowerWord)) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
    
    // Everything else lowercase
    return lowerWord;
  });
  
  return result.join(' ');
}

export type MealCardProps = {
  recipeId: string;
  title: string;
  chef: string;
  timeMins: number;
  conflicts?: string[];
  reasons?: string[];
  /** One line on why the AI chose this meal for this household this week (#94). */
  explanation?: string;
  nutrition?: NutritionInfo;
  /** In the ⋮ menu, "Use a saved recipe"; in SwapDrawer, picking the card. */
  onSwapClick?: () => void;
  onDeleteClick?: () => void;
  disableLink?: boolean; // When true, card won't be a link (used in SwapDrawer)
};

const CardLink = styled(Link)`
  text-decoration: none;
  color: inherit;
  border-radius: ${tokens.base.border.radius[4]};
  &:focus {
    outline: ${tokens.component.iconButton.focus.outline};
    outline-offset: ${tokens.component.iconButton.focus.outlineOffset};
  }
`;

const CardWrapper = styled(Box)`
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;

  &:hover {
    border-color: ${tokens.semantic.color.border["input-hover"]};
  }
`;

const StyledMealCardTitle = styled.h3`
  font: ${tokens.semantic.typography.h3};
  letter-spacing: ${tokens.base.letterSpacing[1]};
  font-size: 1.5rem;
  line-height: 1.75rem;
  color: ${tokens.semantic.color.text.default}
`;

// Tucks the ⋮ button into the card's corner
const MenuCorner = styled.div`
  margin-top: -8px;
  margin-right: -8px;
`;

/** A recipe as a card, for the recipe library and the swap drawer. The plan's nights use PlanMeal (#160). */
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
  disableLink = false,
}: MealCardProps) {
  const handleCardClick = () => {
    if (disableLink && onSwapClick) {
      onSwapClick();
    }
  };

  // Get human-readable chip text from reasons
  const chipLabels = explainReasons(reasons, title, 3).map((chip) => chip.text);

  const cardContent = (
    <div onClick={disableLink ? handleCardClick : undefined}>
      <CardWrapper bg="subtle" borderRadius="lg" p="lg" border="subtle" minHeight="300px">
        <Stack direction="column" gap="md">
          <Stack direction="row" gap="md" alignItems="flex-start">
            <StyledMealCardTitle style={{ flex: 1 }}>{toSentenceCase(title)}</StyledMealCardTitle>
            <MenuCorner>
              <MealMenu
                recipeId={recipeId}
                title={title}
                onSwapClick={disableLink ? undefined : onSwapClick}
                onDeleteClick={onDeleteClick}
              />
            </MenuCorner>
          </Stack>

          {explanation && (
            <Typography variant="small" color="subdued">
              {explanation}
            </Typography>
          )}

          {/* Spacer to push the chips to the bottom */}
          <div style={{ flex: 1 }} />

          <Stack direction="column" gap="sm">
            <Stack direction="row" gap="sm" alignItems="center">
              {chef && <Tag variant="interactive" border={false}>{chef}</Tag>}
              <Chip variant="default">{timeMins} mins</Chip>
              {chipLabels.length > 0 && <ChipGroup labels={chipLabels} variant="default" />}
            </Stack>
            {nutrition && (
              <Stack direction="row" gap="md">
                <Typography variant="small" color="subdued">
                  {nutrition.calories} cal
                </Typography>
                <Typography variant="small" color="subdued">
                  {nutrition.protein}g protein
                </Typography>
              </Stack>
            )}
          </Stack>

          {conflicts.length > 0 && (
            <Stack direction="column" gap="xs">
              <Typography variant="small">Conflicts:</Typography>
              {conflicts.map((conflict, index) => (
                <Typography key={index} variant="small">
                  • {conflict}
                </Typography>
              ))}
            </Stack>
          )}
        </Stack>
      </CardWrapper>
    </div>
  );

  if (disableLink) return cardContent;

  return <CardLink href={`/recipe/${recipeId}`}>{cardContent}</CardLink>;
}
