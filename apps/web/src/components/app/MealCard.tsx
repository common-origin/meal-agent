"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Stack, Typography, Avatar, Box, Button, ChipGroup, IconButton, Divider } from "@common-origin/design-system";
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
  onDeleteClick
}: MealCardProps) {
  const [favorited, setFavorited] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
      p="md"
      border="default"
      style={{ position: 'relative' }}
    >
      {/* Top right buttons */}
      <div style={{ position: "absolute", top: "12px", right: "12px", display: 'flex', gap: '8px', alignItems: 'center' }}>
        {/* Menu button */}
        <div style={{ position: 'relative' }}>
          <IconButton
            variant="secondary"
            iconName="menu"
            size="small"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="More options"
          />
          
          {/* Dropdown menu */}
          {menuOpen && (
            <>
              {/* Backdrop to close menu */}
              <div
                onClick={() => setMenuOpen(false)}
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 998
                }}
              />
              
              {/* Menu */}
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '4px',
                  backgroundColor: 'white',
                  border: '1px solid #dee2e6',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  zIndex: 999,
                  minWidth: '160px'
                }}
              >
                {onDeleteClick && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onDeleteClick();
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: '#dc3545',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8f9fa';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    Remove from plan
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <Stack direction="column" gap="md">
        <Box pr="8xl">
          <Typography variant="h3">{title}</Typography>
        </Box>
        <Stack direction="row" gap="sm" alignItems="center">
          <Avatar name={chef} size="sm" />
          <Typography variant="caption">{chef}</Typography>
        </Stack>
        
        <Stack direction="row" gap="md" alignItems="center">
          <Typography variant="small">{timeMins} mins</Typography>
          {chipLabels.length > 0 && (
            <ChipGroup labels={chipLabels} variant="default" />
          )}
        </Stack>
        
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
        
        {/* Action buttons */}
        <Divider size="small" />
        <Stack direction="row" gap="sm">
          <Link href={`/recipe/${recipeId}`} style={{ textDecoration: 'none' }}>
            <Button
              variant="secondary"
              size="medium"
              purpose="button"
              style={{ width: '100%' }}
            >
              View Recipe
            </Button>
          </Link>
          
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
          {/* Favorite button */}
          <IconButton
            variant={favorited ? "primary" : "secondary"}
            iconName={favorited ? "close" : "add"}
            onClick={handleFavoriteClick}
            aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
          />
        </Stack>
      </Stack>
    </Box>
  );
}