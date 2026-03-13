"use client";

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Typography, Box, Stack, Button } from "@common-origin/design-system";
import { MemoizedMealCard, type MealCardProps } from "./MealCard";

export type SortableDayProps = {
  id: string;
  day: string;
  index: number;
  meal: MealCardProps | null;
  onSwapClick?: (index: number) => void;
  onDeleteClick?: (index: number) => void;
  onGenerateClick?: (index: number) => void;
  onAddSavedRecipeClick?: (index: number) => void;
};

export default function SortableDay({
  id,
  day,
  index,
  meal,
  onSwapClick,
  onDeleteClick,
  onGenerateClick,
  onAddSavedRecipeClick,
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
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", height: "100%" }}>
        <Typography variant="label">{day}</Typography>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "300px" }}>
          {meal ? (
            <MemoizedMealCard
              {...meal}
              onSwapClick={onSwapClick ? () => onSwapClick(index) : undefined}
              onDeleteClick={onDeleteClick ? () => onDeleteClick(index) : undefined}
              dragHandleRef={setActivatorNodeRef}
              dragListeners={listeners}
            />
          ) : (
            <Box
              borderRadius="lg"
              p="xl"
              bg="surface"
              border="subtle"
              minHeight="300px"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                alignItems: "center",
                flex: 1,
                justifyContent: "center",
                textAlign: "center",
                borderStyle: "dashed",
                borderWidth: "2px"
              }}
            >
              <Typography variant="label" color="subdued">
                No meal planned
              </Typography>
              {(onAddSavedRecipeClick || onGenerateClick) && (          
                <Stack direction="column" gap="sm">
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
            </Box>
          )}
        </div>
      </div>
    </div>
  );
}
