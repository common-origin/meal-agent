"use client";

import { useState, useEffect, useRef, MouseEvent, memo } from "react";
import styled from "styled-components";
import Link from "next/link";
import { Chip, Stack, Typography, Box, ChipGroup, IconButton, Tag, List, ListItem } from "@common-origin/design-system";
import { tokens } from "@common-origin/design-system";
import { toggleFavorite, isFavorite } from "@/lib/storage";
import { track } from "@/lib/analytics";
import { explainReasons } from "@/lib/explainer";
import type { NutritionInfo } from "@/lib/types/recipe";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";

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
  dragHandleRef?: (node: HTMLElement | null) => void;
  dragListeners?: SyntheticListenerMap;
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

const MenuWrapper = styled.div`
  position: relative;
  flex-shrink: 0;
  margin-top: -8px;
  margin-right: -8px;
`;

const CardOuter = styled.div`
  position: relative;
  height: 100%;
`;

const DragHandle = styled.div`
  position: absolute;
  bottom: ${tokens.semantic.spacing.layout.sm};
  right: ${tokens.semantic.spacing.layout.sm};
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  cursor: grab;
  transition: opacity 0.2s;
  touch-action: none;
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
  dragHandleRef,
  dragListeners,
}: MealCardProps) {
  const [favorited, setFavorited] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFavorited(isFavorite(recipeId));
  }, [recipeId]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

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
        <Stack direction="column" gap="md">
          {/* Top section - Title and Menu */}
          <Stack direction="row" gap="md" alignItems="flex-start">
            <StyledMealCardTitle style={{ flex: 1 }}>{toSentenceCase(title)}</StyledMealCardTitle>
            {/* Kebab menu - stopPropagation prevents menu clicks from triggering card link */}
            <MenuWrapper ref={menuRef} onClick={(e: MouseEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); }}>
              <IconButton
                variant="naked"
                iconName="kebab"
                size="medium"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Recipe options"
              />
              {menuOpen && (
                <Box
                  border="default"
                  borderRadius="lg"
                  bg="default"
                  p="none"
                  style={{
                    position: 'absolute',
                    overflow: 'hidden',
                    right: 0,
                    top: '100%',
                    marginTop: 4,
                    zIndex: 10,
                    minWidth: 220,
                    boxShadow: tokens.semantic.elevation.floating,
                  }}
                >
                  <List dividers spacing="compact">
                    {onSwapClick && !disableLink && (
                      <ListItem
                        primary="Swap meal"
                        interactive
                        onClick={() => {
                          onSwapClick();
                          setMenuOpen(false);
                        }}
                      />
                    )}
                    <ListItem
                      primary={favorited ? 'Remove from favourites' : 'Favourite this recipe'}
                      interactive
                      onClick={() => {
                        handleFavoriteClick();
                        setMenuOpen(false);
                      }}
                    />
                    {onDeleteClick && (
                      <ListItem
                        primary="Remove from plan"
                        interactive
                        destructive
                        onClick={() => {
                          onDeleteClick();
                          setMenuOpen(false);
                        }}
                      />
                    )}
                  </List>
                </Box>
              )}
            </MenuWrapper>
          </Stack>

          {/* Spacer to push buttons to bottom */}
          <div style={{ flex: 1 }} />
          
          <div>
            <Stack direction="column" gap="sm">
              <Stack direction="row" gap="sm">
                {chef && <Tag variant="interactive" border={false}>{chef}</Tag>}
                <Chip variant="default">{timeMins} mins</Chip>
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

          </div>

        </Stack>
      </CardWrapper>
    </div>
  );

  const dragHandle = dragHandleRef ? (
    <DragHandle
      ref={dragHandleRef}
      {...(dragListeners as React.HTMLAttributes<HTMLDivElement>)}
    >
      <IconButton
        variant="naked"
        iconName="move"
        size="small"
        aria-label="Drag to reorder meal"
        style={{ pointerEvents: 'none' }}
      />
    </DragHandle>
  ) : null;

  // Return wrapped in link or unwrapped
  // Drag handle is placed outside the link to prevent drag from triggering navigation
  if (disableLink) {
    return (
      <CardOuter>
        {cardContent}
        {dragHandle}
      </CardOuter>
    );
  }

  return (
    <CardOuter>
      <CardLink href={`/recipe/${recipeId}`}>
        {cardContent}
      </CardLink>
      {dragHandle}
    </CardOuter>
  );
}

// Memoize to prevent unnecessary re-renders
export const MemoizedMealCard = memo(MealCard);