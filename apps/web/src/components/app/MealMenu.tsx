"use client";

import { useEffect, useState, type MouseEvent } from "react";
import styled from "styled-components";
import { IconButton, Menu, MenuDivider, MenuItem } from "@common-origin/design-system";
import { isFavorite } from "@/lib/storage";
import { toggleFavorite } from "@/lib/hybridStorage";
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
  /** The destructive item's label: what it really does where the menu is used (#179). */
  deleteLabel?: string;
};

// Menu places its panel in a floating layer, so this only keeps the ⋮ from shrinking
const MenuWrapper = styled.div`
  flex-shrink: 0;
`;

/**
 * A meal's ⋮ menu: swap, move, favourite and remove. The design system's Menu, which brings
 * keyboard navigation, Escape, menu roles and focus handling, as on the recipe page.
 */
export default function MealMenu({ recipeId, title, onSwapClick, onMoveClick, onDeleteClick, deleteLabel = "Remove from plan" }: MealMenuProps) {
  const [favorited, setFavorited] = useState(false);

  useEffect(() => {
    setFavorited(isFavorite(recipeId));
  }, [recipeId]);

  const handleFavorite = () => {
    const next = toggleFavorite(recipeId);
    setFavorited(next);
    track(next ? "favorite_added" : "favorite_removed", { recipeId });
  };

  return (
    // stopPropagation: the menu can sit inside a card link (React events bubble here from the menu too)
    <MenuWrapper onClick={(e: MouseEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); }}>
      <Menu
        align="end"
        trigger={
          <IconButton variant="naked" iconName="kebab" size="medium" aria-label={`More options for ${title}`} />
        }
      >
        {/* No dividers between items: a menu's dividers mark groups. The one group is the
            destructive action, set apart below a single divider. */}
        {onSwapClick && <MenuItem onSelect={onSwapClick}>Use a saved recipe</MenuItem>}
        {onMoveClick && <MenuItem onSelect={onMoveClick}>Move to another night…</MenuItem>}
        <MenuItem onSelect={handleFavorite}>
          {favorited ? "Remove from favourites" : "Favourite this recipe"}
        </MenuItem>
        {onDeleteClick && (
          <>
            <MenuDivider />
            <MenuItem destructive onSelect={onDeleteClick}>
              {deleteLabel}
            </MenuItem>
          </>
        )}
      </Menu>
    </MenuWrapper>
  );
}
