"use client";

import { useState, useEffect } from "react";
import { Stack, Typography, Avatar, Box, Button, ChipGroup, IconButton } from "@common-origin/design-system";
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
};

export default function MealCard({ 
  recipeId,
  title, 
  chef, 
  timeMins, 
  kidsFriendly = false, 
  conflicts = [],
  reasons = [],
  onSwapClick
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
      borderRadius={3}
      p="md"
      border="default"
    >
      {/* Heart toggle button */}
      <div style={{ position: "absolute", top: "12px", right: "12px" }}>
        <IconButton
          variant={favorited ? "primary" : "secondary"}
          iconName={favorited ? "close" : "add"}
          size="medium"
          onClick={handleFavoriteClick}
          aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
        />
      </div>

      <Stack direction="column" gap="md">
        <Typography variant="h3">{title}</Typography>
        
        <Stack direction="row" gap="sm" alignItems="center">
          <Avatar name={chef} size="sm" />
          <Typography variant="body">{chef}</Typography>
        </Stack>
        
        <Stack direction="row" gap="md" alignItems="center">
          <Typography variant="small">{timeMins} mins</Typography>
          {kidsFriendly && (
            <Typography variant="small">
              👶 Kid-friendly
            </Typography>
          )}
        </Stack>

        {/* Reason chips */}
        {chipLabels.length > 0 && (
          <ChipGroup labels={chipLabels} variant="default" />
        )}
        
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
        
        {/* Swap button */}
        {onSwapClick && (
          <Button
            variant="secondary"
            size="medium"
            onClick={(e) => {
              e.stopPropagation();
              onSwapClick();
            }}
          >
            Swap meal
          </Button>
        )}
      </Stack>
    </Box>
  );
}