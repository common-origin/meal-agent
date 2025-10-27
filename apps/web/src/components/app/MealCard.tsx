"use client";

import { useState, useEffect } from "react";
import { Stack, Typography, Avatar, Chip } from "@common-origin/design-system";
import { toggleFavorite, isFavorite } from "@/lib/storage";
import { track } from "@/lib/analytics";

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

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const newFavorited = !favorited;
    toggleFavorite(recipeId);
    setFavorited(newFavorited);
    
    // Track analytics
    track(newFavorited ? "favorite_added" : "favorite_removed", { recipeId });
  };

  return (
    <div style={{ 
      border: "1px solid #e9ecef", 
      borderRadius: "8px", 
      padding: "16px", 
      backgroundColor: "white",
      position: "relative"
    }}>
      {/* Heart toggle button */}
      <button
        onClick={handleFavoriteClick}
        style={{
          position: "absolute",
          top: "12px",
          right: "12px",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: "24px",
          padding: "4px",
          lineHeight: 1
        }}
        aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
      >
        {favorited ? "❤️" : "🤍"}
      </button>

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
        {reasons.length > 0 && (
          <div style={{ 
            display: "flex", 
            flexWrap: "wrap", 
            gap: "8px" 
          }}>
            {reasons.map((reason, index) => (
              <Chip key={index} size="small" variant="subtle">
                {reason}
              </Chip>
            ))}
          </div>
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
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSwapClick();
            }}
            style={{
              padding: "8px 16px",
              backgroundColor: "#f8f9fa",
              border: "1px solid #dee2e6",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              marginTop: "8px"
            }}
          >
            🔄 Swap meal
          </button>
        )}
      </Stack>
    </div>
  );
}