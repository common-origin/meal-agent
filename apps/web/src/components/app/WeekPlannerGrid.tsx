import { Stack, Typography, ResponsiveGrid, Box } from "@common-origin/design-system";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { MemoizedMealCard, type MealCardProps } from "./MealCard";
import SortableDay from "./SortableDay";
import LoadingSkeleton from "./LoadingSkeleton";

export type WeekPlannerGridProps = {
  meals: (MealCardProps | null)[];
  onSwapClick?: (dayIndex: number) => void;
  onGenerateClick?: (dayIndex: number) => void;
  onAddSavedRecipeClick?: (dayIndex: number) => void;
  generatingDayIndex?: number | null;
  onDeleteClick?: (dayIndex: number) => void;
  isGeneratingPlan?: boolean;
  onReorder?: (oldIndex: number, newIndex: number) => void;
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Now using shared LoadingSkeleton component with ARIA support

export default function WeekPlannerGrid({ 
  meals, 
  onSwapClick, 
  onGenerateClick, 
  onAddSavedRecipeClick, 
  generatingDayIndex, 
  onDeleteClick, 
  isGeneratingPlan,
  onReorder 
}: WeekPlannerGridProps) {
  
  // Set up sensors for drag interactions
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // 200ms delay before drag starts on touch
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;
    
    const oldIndex = DAYS.indexOf(active.id as string);
    const newIndex = DAYS.indexOf(over.id as string);
    
    if (oldIndex !== -1 && newIndex !== -1 && onReorder) {
      onReorder(oldIndex, newIndex);
    }
  };

  // If generating the whole plan, show loading state without drag-and-drop
  if (isGeneratingPlan) {
    return (
      <Box mt="2xl">
        <Stack direction="column" gap="lg">      
          <ResponsiveGrid 
            cols={1} 
            colsSm={2} 
            colsMd={3} 
            colsLg={4}
            gapX={4}
            gapY={8}
          >
            {DAYS.map((day) => (
              <div key={day} style={{ display: "flex", flexDirection: "column", gap: "8px", height: "100%" }}>
                <Typography variant="caption">{day}</Typography>
                <LoadingSkeleton ariaLabel={`Loading recipe for ${day}`} />
              </div>
            ))}
          </ResponsiveGrid>
        </Stack>
      </Box>
    );
  }

  return (
    <Box mt="2xl">
      <Stack direction="column" gap="lg">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={DAYS} strategy={rectSortingStrategy}>
            <ResponsiveGrid 
              cols={1} 
              colsSm={2} 
              colsMd={3} 
              colsLg={4}
              gapX={4}
              gapY={8}
            >
              {DAYS.map((day, index) => {
                // Show individual loading state for specific day
                if (generatingDayIndex === index) {
                  return (
                    <div key={day} style={{ display: "flex", flexDirection: "column", gap: "8px", height: "100%" }}>
                      <Typography variant="caption">{day}</Typography>
                      <LoadingSkeleton ariaLabel={`Generating AI recipe for ${day}`} />
                    </div>
                  );
                }

                // Show sortable day (with or without meal)
                return (
                  <SortableDay
                    key={day}
                    id={day}
                    day={day}
                    index={index}
                    meal={meals[index]}
                    onSwapClick={onSwapClick}
                    onDeleteClick={onDeleteClick}
                    onGenerateClick={onGenerateClick}
                    onAddSavedRecipeClick={onAddSavedRecipeClick}
                  />
                );
              })}
            </ResponsiveGrid>
          </SortableContext>
        </DndContext>
      </Stack>
    </Box>
  );
}