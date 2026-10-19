import { Alert, Button, Stack, Box } from "@common-origin/design-system";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { MealCardProps } from "./MealCard";
import SortableDay from "./SortableDay";
import LoadingSkeleton from "./LoadingSkeleton";
import DayRow from "./DayRow";

export type WeekPlanListProps = {
  meals: (MealCardProps | null)[];
  onSwapClick?: (dayIndex: number) => void;
  onGenerateClick?: (dayIndex: number) => void;
  onAddSavedRecipeClick?: (dayIndex: number) => void;
  /** Days whose AI recipe is still being generated; each shows a skeleton (#95). */
  generatingDays?: number[];
  /** Per-day generation errors (friendly copy, #96), shown with a Retry button. */
  dayErrors?: Record<number, string>;
  onRetryDay?: (dayIndex: number) => void;
  onDeleteClick?: (dayIndex: number) => void;
  /** Skeletons for every night, for the initial load only. */
  isGeneratingPlan?: boolean;
  onReorder?: (oldIndex: number, newIndex: number) => void;
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const ROW_SKELETON_HEIGHT = "120px";

/** The week as a Monday–Sunday list (#38), one row per night. */
export default function WeekPlanList({
  meals,
  onSwapClick,
  onGenerateClick,
  onAddSavedRecipeClick,
  generatingDays = [],
  dayErrors = {},
  onRetryDay,
  onDeleteClick,
  isGeneratingPlan,
  onReorder,
}: WeekPlanListProps) {
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

  if (isGeneratingPlan) {
    return (
      <Box mt="xl">
        <Stack direction="column" gap="md">
          {DAYS.map((day) => (
            <DayRow key={day} day={day}>
              <LoadingSkeleton ariaLabel={`Loading recipe for ${day}`} height={ROW_SKELETON_HEIGHT} />
            </DayRow>
          ))}
        </Stack>
      </Box>
    );
  }

  return (
    <Box mt="xl">
      {/* A stable id keeps dnd-kit's generated aria-describedby the same on server and client. */}
      <DndContext id="week-plan-list" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={DAYS} strategy={verticalListSortingStrategy}>
          <Stack direction="column" gap="md">
            {DAYS.map((day, index) => {
              // Each night shows its own skeleton until its own request resolves (#95)
              if (generatingDays.includes(index)) {
                return (
                  <DayRow key={day} day={day}>
                    <LoadingSkeleton ariaLabel={`Generating AI recipe for ${day}`} height={ROW_SKELETON_HEIGHT} />
                  </DayRow>
                );
              }

              // A night whose generation failed: the error, and a retry for just this night
              const error = dayErrors[index];
              if (error && !meals[index]) {
                return (
                  <DayRow key={day} day={day}>
                    <Box borderRadius="lg" p="md" bg="surface" border="subtle">
                      <Stack direction="row" gap="md" alignItems="center" justifyContent="space-between" wrap>
                        <Alert variant="error" inline>
                          {error}
                        </Alert>
                        {onRetryDay && (
                          <Button variant="primary" size="small" onClick={() => onRetryDay(index)}>
                            Retry this day
                          </Button>
                        )}
                      </Stack>
                    </Box>
                  </DayRow>
                );
              }

              return (
                <SortableDay
                  key={day}
                  id={day}
                  day={day}
                  index={index}
                  meal={meals[index] ?? null}
                  onSwapClick={onSwapClick}
                  onDeleteClick={onDeleteClick}
                  onGenerateClick={onGenerateClick}
                  onAddSavedRecipeClick={onAddSavedRecipeClick}
                />
              );
            })}
          </Stack>
        </SortableContext>
      </DndContext>
    </Box>
  );
}
