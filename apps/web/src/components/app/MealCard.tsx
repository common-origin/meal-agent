"use client";

import { useState, useEffect, MouseEvent, memo } from "react";
import styled from "styled-components";
import Link from "next/link";
import { Stack, Typography, Box, ChipGroup, IconButton, Divider, Tag } from "@common-origin/design-system";
import { tokens } from "@common-origin/design-system";
import { toggleFavorite, isFavorite } from "@/lib/storage";
import { track } from "@/lib/analytics";
import { explainReasons } from "@/lib/explainer";
import type { NutritionInfo } from "@/lib/types/recipe";

// Convert title to sentence case while preserving proper nouns
function toSentenceCase(str: string): string {
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
  nutrition?: NutritionInfo;
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

const CardWrapper = styled(Box)<{ $clickable?: boolean }>`
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;

  &:hover {
    border-color: ${tokens.semantic.color.border.strong};
  }
`;

const StyledMealCardTitle = styled.h3`
  font: ${tokens.semantic.typography.h3};
  letter-spacing: ${tokens.base.letterSpacing[1]};
  font-size: 1.5rem;
  line-height: 1.75rem;
  color: ${tokens.semantic.color.text.default}
`;

export default function MealCard({ 
  recipeId,
  title,
  chef,
  timeMins, 
  conflicts = [],
  reasons = [],
  nutrition,
  onSwapClick,
  onDeleteClick,
  disableLink = false,
}: MealCardProps) {
  const [favorited, setFavorited] = useState(false);

  useEffect(() => {
    setFavorited(isFavorite(recipeId));
  }, [recipeId]);

  const handleFavoriteClick = (e?: MouseEvent<HTMLButtonElement>) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const newFavorited = !favorited;
    toggleFavorite(recipeId);
    setFavorited(newFavorited);
    
    // Track analytics
    track(newFavorited ? "favorite_added" : "favorite_removed", { recipeId });
  };

  const handleCardClick = () => {
    if (disableLink && onSwapClick) {
      onSwapClick();
    }
  };

  // Get human-readable chip text from reasons
  const explainedReasons = explainReasons(reasons, title, 3);
  const chipLabels = explainedReasons.map(chip => chip.text);

  const cardContent = (
    <div onClick={disableLink ? handleCardClick : undefined}>
      <CardWrapper 
        bg="default"
        borderRadius="lg"
        p="lg"
        border="subtle"
        minHeight="300px"
        $clickable={disableLink && !!onSwapClick}
      >
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '16px' }}>
          {/* Top section - Title and Chef */}
          <StyledMealCardTitle>{toSentenceCase(title)}</StyledMealCardTitle>

          {/* Spacer to push buttons to bottom */}
          <div style={{ flex: 1 }} />
          
          <div>
            <Stack direction="column" gap="sm">
              <Stack direction="row" gap="sm">
                {chef && <Tag variant="interactive" border={false}>{chef}</Tag>}
                <Typography variant="small">{timeMins} mins</Typography>
              </Stack>
              {/* Middle section - Time and Chips */}
              <Stack direction="row" gap="md" alignItems="center">
                {chipLabels.length > 0 && (
                  <ChipGroup labels={chipLabels} variant="default" />
                )}
              </Stack>
              {/* Nutrition summary (if available) */}
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
            {/* Conflicts section (optional) */}
            {conflicts.length > 0 && (
              <Stack direction="column" gap="xs">
                <Typography variant="small">
                  Conflicts:
                </Typography>
                {conflicts.map((conflict, index) => (
                  <Typography key={index} variant="small">
                    • {conflict}
                  </Typography>
                ))}
              </Stack>
            )}
            {/* Bottom section - Action buttons */}
            <Divider size="small" />
            <div onClick={(e: MouseEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); }}>
              <Stack direction="row" gap="sm">
                {onSwapClick && !disableLink && (
                  <IconButton
                    variant="naked"
                    iconName="refresh"
                    onClick={onSwapClick}
                    aria-label="Swap meal"
                  />
                )}
                
                {/* Favorite button */}
                <IconButton
                  variant={favorited ? "secondary" : "naked"}
                  iconName={favorited ? "starFilled" : "star"}
                  onClick={handleFavoriteClick}
                  aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
                />

                {/* Remove button */}
                {onDeleteClick && (
                  <IconButton
                    variant="naked"
                    iconName="trash"
                    onClick={onDeleteClick}
                    aria-label="Remove from plan"
                  />
                )}
              </Stack>
            </div>
          </div>
        </div>
      </CardWrapper>
    </div>
  );

  // Return wrapped in link or unwrapped
  if (disableLink) {
    return cardContent;
  }

  return (
    <CardLink href={`/recipe/${recipeId}`}>
      {cardContent}
    </CardLink>
  );
}

// Memoize to prevent unnecessary re-renders
export const MemoizedMealCard = memo(MealCard);