"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import styled from "styled-components";
import { Box, IconButton, List, ListItem, tokens } from "@common-origin/design-system";
import { toggleFavorite, isFavorite } from "@/lib/storage";
import { track } from "@/lib/analytics";

export type MealMenuProps = {
  recipeId: string;
  /** Names the meal in the button's label. */
  title: string;
  /** "Use a saved recipe" for this night. */
  onSwapClick?: () => void;
  /** "Move to another night…": the non-drag way to reorder (#160). */
  onMoveClick?: () => void;
  onDeleteClick?: () => void;
};

const MenuWrapper = styled.div`
  position: relative;
  flex-shrink: 0;
`;

/** A meal's ⋮ menu: swap, move, favourite and remove. */
export default function MealMenu({ recipeId, title, onSwapClick, onMoveClick, onDeleteClick }: MealMenuProps) {
  const [favorited, setFavorited] = useState(false);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFavorited(isFavorite(recipeId));
  }, [recipeId]);

  // Close on a click outside or Escape
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const choose = (action: () => void) => () => {
    action();
    setOpen(false);
  };

  const handleFavorite = () => {
    const next = !favorited;
    toggleFavorite(recipeId);
    setFavorited(next);
    track(next ? "favorite_added" : "favorite_removed", { recipeId });
  };

  return (
    // stopPropagation: the menu can sit inside a card link
    <MenuWrapper ref={menuRef} onClick={(e: MouseEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); }}>
      <IconButton
        variant="naked"
        iconName="kebab"
        size="medium"
        onClick={() => setOpen(!open)}
        aria-label={`More options for ${title}`}
        aria-expanded={open}
      />
      {open && (
        <Box
          border="default"
          borderRadius="lg"
          bg="subtle"
          p="none"
          style={{
            position: "absolute",
            overflow: "hidden",
            right: 0,
            top: "100%",
            marginTop: 4,
            zIndex: 10,
            minWidth: 220,
            boxShadow: tokens.semantic.elevation.floating,
          }}
        >
          <List dividers spacing="compact">
            {onSwapClick && <ListItem primary="Use a saved recipe" interactive onClick={choose(onSwapClick)} />}
            {onMoveClick && <ListItem primary="Move to another night…" interactive onClick={choose(onMoveClick)} />}
            <ListItem
              primary={favorited ? "Remove from favourites" : "Favourite this recipe"}
              interactive
              onClick={choose(handleFavorite)}
            />
            {onDeleteClick && (
              <ListItem primary="Remove from plan" interactive destructive onClick={choose(onDeleteClick)} />
            )}
          </List>
        </Box>
      )}
    </MenuWrapper>
  );
}
