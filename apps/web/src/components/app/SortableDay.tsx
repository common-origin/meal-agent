"use client";

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Typography, Box, Stack, Button } from "@common-origin/design-system";
import { MemoizedMealCard, type MealCardProps } from "./MealCard";
import DayRow from "./DayRow";

export type SortableDayProps = {
  id: string;
  day: string;
  index: number;
  meal: MealCardProps | null;
  onSwapClick?: (index: number) => void;
  onDeleteClick?: (index: number) => void;
  onGenerateClick?: (index: number) => void;
  onAddSavedRecipeClick?: (index: number) => void;
  /** "Change this": puts the night in the edit input (#38). */
  onChangeClick?: (index: number) => void;
};

/** One night of the plan list (#38): drag to reorder when it has a meal. */
export default function SortableDay({
  id,
  day,
  index,
  meal,
  onSwapClick,
  onDeleteClick,
  onGenerateClick,
  onAddSavedRecipeClick,
  onChangeClick,
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
    disabled: !meal, // Only allow dragging if there's a meal
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <DayRow day={day}>
        {meal ? (
          <MemoizedMealCard
            {...meal}
            variant="row"
            onSwapClick={onSwapClick ? () => onSwapClick(index) : undefined}
            onDeleteClick={onDeleteClick ? () => onDeleteClick(index) : undefined}
            onChangeClick={onChangeClick ? () => onChangeClick(index) : undefined}
            dragHandleRef={setActivatorNodeRef}
            dragListeners={listeners}
          />
        ) : (
          <Box
            borderRadius="lg"
            p="md"
            bg="surface"
            border="subtle"
            style={{ borderStyle: "dashed", borderWidth: "2px" }}
          >
            <Stack direction="row" gap="md" alignItems="center" justifyContent="space-between" wrap>
              <Typography variant="label" color="subdued">
                No meal planned
              </Typography>
              {(onAddSavedRecipeClick || onGenerateClick) && (
                <Stack direction="row" gap="sm">
                  {onAddSavedRecipeClick && (
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => onAddSavedRecipeClick(index)}
                      iconName="add"
                    >
                      Add saved recipe
                    </Button>
                  )}
                  {onGenerateClick && (
                    <Button
                      variant="primary"
                      size="small"
                      onClick={() => onGenerateClick(index)}
                    >
                      Generate
                    </Button>
                  )}
                </Stack>
              )}
            </Stack>
          </Box>
        )}
      </DayRow>
    </div>
  );
}
