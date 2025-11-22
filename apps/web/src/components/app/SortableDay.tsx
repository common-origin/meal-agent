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
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Typography variant="caption">{day}</Typography>
          {meal && (
            <button
              ref={setActivatorNodeRef}
              {...listeners}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px',
                cursor: 'grab',
                display: 'flex',
                alignItems: 'center',
                opacity: 0.5,
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '0.5'}
              aria-label="Drag to reorder meal"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="4" cy="3" r="1.5"/>
                <circle cx="12" cy="3" r="1.5"/>
                <circle cx="4" cy="8" r="1.5"/>
                <circle cx="12" cy="8" r="1.5"/>
                <circle cx="4" cy="13" r="1.5"/>
                <circle cx="12" cy="13" r="1.5"/>
              </svg>
            </button>
          )}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "300px" }}>
          {meal ? (
            <MemoizedMealCard
              {...meal}
              onSwapClick={onSwapClick ? () => onSwapClick(index) : undefined}
              onDeleteClick={onDeleteClick ? () => onDeleteClick(index) : undefined}
            />
          ) : (
            <Box
              borderRadius="4"
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
                <div style={{ width: '100%', maxWidth: '200px' }}>
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
                        Generate with AI
                      </Button>
                    )}
                  </Stack>
                </div>
              )}
            </Box>
          )}
        </div>
      </div>
    </div>
  );
}
