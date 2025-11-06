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
  // Customization options
  showMenu?: boolean;
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
  showMenu = true,
  swapButtonText = "Swap meal",
  swapButtonVariant = "secondary",
  viewRecipeButtonText = "View Recipe",
  viewRecipeButtonVariant = "secondary",
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
      p="lg"
      border="default"
      style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      {/* Top right buttons */}
      {showMenu && (
        <div style={{ position: "absolute", top: "12px", right: "12px", display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Menu button */}
          <div style={{ position: 'relative' }}>
            <IconButton
              variant="secondary"
              iconName="close"
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
      )}

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '16px' }}>
        {/* Top section - Title and Chef */}
        <Box pr="8xl">
          <Typography variant="h3">{title}</Typography>
        </Box>

        {/* Spacer to push buttons to bottom */}
        <div style={{ flex: 1 }} />
        
        <div>
          <Box mb="lg">
            <Stack direction="row" gap="sm" alignItems="center">
              <Avatar name={chef} size="sm" />
              <Typography variant="label">{chef}</Typography>
            </Stack>
          </Box>
          {/* Middle section - Time and Chips */}
          <Stack direction="row" gap="md" alignItems="center">
            <Typography variant="small">{timeMins} mins</Typography>
            {chipLabels.length > 0 && (
              <ChipGroup labels={chipLabels} variant="default" />
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
                style={{ width: '100%' }}
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
          </Stack>
        </div>
      </div>
    </Box>
  );
}