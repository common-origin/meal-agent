"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Stack, Typography, Box, Button, ChipGroup, IconButton, Divider, Tag } from "@common-origin/design-system";
import { toggleFavorite, isFavorite } from "@/lib/storage";
import { track } from "@/lib/analytics";
import { explainReasons } from "@/lib/explainer";

export type MealCardProps = {
  recipeId: string;
  title: string;
  chef: string;
  timeMins: number;
  kidsFriendly?: boolean;
  conflicts?: string[];
  reasons?: string[];
  onSwapClick?: () => void;
  onDeleteClick?: () => void;
  // Customization options
  swapButtonText?: string;
  swapButtonVariant?: "primary" | "secondary";
  viewRecipeButtonText?: string;
  viewRecipeButtonVariant?: "primary" | "secondary";
};

export default function MealCard({ 
  recipeId,
  title,
  chef,
  timeMins, 
  kidsFriendly = false, 
  conflicts = [],
  reasons = [],
  onSwapClick,
  onDeleteClick,
  swapButtonText = "Swap meal",
  swapButtonVariant = "secondary",
  viewRecipeButtonText = "View Recipe",
  viewRecipeButtonVariant = "secondary",
}: MealCardProps) {
  const [favorited, setFavorited] = useState(false);

  useEffect(() => {
    setFavorited(isFavorite(recipeId));
  }, [recipeId]);

  const handleFavoriteClick = () => {
    const newFavorited = !favorited;
    toggleFavorite(recipeId);
    setFavorited(newFavorited);
    
    // Track analytics
    track(newFavorited ? "favorite_added" : "favorite_removed", { recipeId });
  };

  // Get human-readable chip text from reasons
  const explainedReasons = explainReasons(reasons, title, 3);
  const chipLabels = explainedReasons.map(chip => 
    chip.icon ? `${chip.icon} ${chip.text}` : chip.text
  );

  return (
    <Box 
      bg="default"
      borderRadius="3"
      p="lg"
      border="default"
      minHeight="300px"
      style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '16px' }}>
        {/* Top section - Title and Chef */}
        <Typography variant="h3">{title}</Typography>

        {/* Spacer to push buttons to bottom */}
        <div style={{ flex: 1 }} />
        
        <div>
          <Stack direction="column" gap="sm">
            <Stack direction="row" gap="sm">
              <Tag variant="interactive" border={false}>{chef}</Tag>
              <Typography variant="small">{timeMins} mins</Typography>
            </Stack>
            {/* Middle section - Time and Chips */}
            <Stack direction="row" gap="md" alignItems="center">
              {chipLabels.length > 0 && (
                <ChipGroup labels={chipLabels} variant="default" />
              )}
            </Stack>
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
          <Stack direction="row" gap="sm">
            {onSwapClick && (
              <Button
                variant={swapButtonVariant}
                size="medium"
                onClick={(e) => {
                  e.stopPropagation();
                  onSwapClick();
                }}
              >
                {swapButtonText}
              </Button>
            )}
            
            <Link href={`/recipe/${recipeId}`} style={{ textDecoration: 'none' }}>
              <Button
                variant={viewRecipeButtonVariant}
                size="medium"
                purpose="button"
              >
                {viewRecipeButtonText}
              </Button>
            </Link>
            
            {/* Favorite button */}
            <IconButton
              variant={favorited ? "secondary" : "naked"}
              iconName={favorited ? "starFilled" : "star"}
              onClick={handleFavoriteClick}
              aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
            />

            {/* Remove button */}
            <IconButton
              variant="naked"
              iconName="trash"
              onClick={onDeleteClick}
              aria-label="Remove from plan"
            />
          </Stack>
        </div>
      </div>
    </Box>
  );
}