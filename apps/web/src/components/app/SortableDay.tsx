"use client";

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import styled from "styled-components";
import { Button, Icon, Typography, tokens } from "@common-origin/design-system";
import type { MealCardProps } from "./MealCard";
import DayCard from "./DayCard";
import MealMenu from "./MealMenu";
import PlanMeal from "./PlanMeal";

export type SortableDayProps = {
  id: string;
  day: string;
  date?: string;
  index: number;
  meal: MealCardProps | null;
  /** The meal's tags to show, less any the whole week shares (#160). */
  tags: string[];
  onSwapClick?: (index: number) => void;
  onDeleteClick?: (index: number) => void;
  onGenerateClick?: (index: number) => void;
  onAddSavedRecipeClick?: (index: number) => void;
  /** "Change this": puts the night in the edit input (#38). */
  onChangeClick?: (index: number) => void;
  /** "Move to another night…" in the ⋮ menu (#160). */
  onMoveClick?: (index: number) => void;
  /** Whether the grip can drag (it can't while the plan is busy). */
  canReorder?: boolean;
};

// A real button, so keyboard sorting starts from it (dnd-kit's attributes and listeners)
const Grip = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 2.5rem;
  padding: 0;
  border: 0;
  border-radius: ${tokens.semantic.border.radius.sm};
  background: transparent;
  color: ${tokens.semantic.color.text.subdued};
  cursor: grab;
  touch-action: none;
  &:hover {
    color: ${tokens.semantic.color.text.default};
  }
  &:focus-visible {
    outline: ${tokens.semantic.border.focus};
  }
`;

/** One night of the plan list (#38, #160): drag by the grip to reorder when it has a meal. */
export default function SortableDay({
  id,
  day,
  date,
  index,
  meal,
  tags,
  onSwapClick,
  onDeleteClick,
  onGenerateClick,
  onAddSavedRecipeClick,
  onChangeClick,
  onMoveClick,
  canReorder = false,
}: SortableDayProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    setActivatorNodeRef,
  } = useSortable({
    id,
    disabled: !meal || !canReorder, // Only a meal moves, and not while the plan is busy
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (!meal) {
    return (
      <div ref={setNodeRef} style={style}>
        <DayCard
          day={day}
          date={date}
          layout="empty"
          tone="empty"
          actions={
            (onAddSavedRecipeClick || onGenerateClick) && (
              <>
                {onAddSavedRecipeClick && (
                  <Button variant="naked" size="medium" onClick={() => onAddSavedRecipeClick(index)}>
                    Add saved recipe
                  </Button>
                )}
                {onGenerateClick && (
                  <Button variant="secondary" size="medium" onClick={() => onGenerateClick(index)}>
                    Generate
                  </Button>
                )}
              </>
            )
          }
        >
          <Typography variant="body" color="subdued">
            Nothing planned
          </Typography>
        </DayCard>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style}>
      <DayCard
        day={day}
        date={date}
        lead={
          canReorder && (
            <Grip ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={`Reorder ${day}`}>
              <Icon name="move" size="sm" iconColor="inherit" />
            </Grip>
          )
        }
        actions={
          <>
            {onChangeClick && (
              // Visible, not in the ⋮ menu: changing a night is the main edit (#38).
              <Button variant="secondary" size="medium" onClick={() => onChangeClick(index)} aria-label={`Change ${meal.title}`}>
                Change
              </Button>
            )}
            <MealMenu
              recipeId={meal.recipeId}
              title={meal.title}
              onSwapClick={onSwapClick ? () => onSwapClick(index) : undefined}
              onMoveClick={onMoveClick ? () => onMoveClick(index) : undefined}
              onDeleteClick={onDeleteClick ? () => onDeleteClick(index) : undefined}
            />
          </>
        }
      >
        <PlanMeal {...meal} tags={tags} />
      </DayCard>
    </div>
  );
}
