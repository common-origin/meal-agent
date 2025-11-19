import { Stack, Typography, Button, ResponsiveGrid, Box } from "@common-origin/design-system";
import { tokens } from "@common-origin/design-system/tokens";
import { MemoizedMealCard, type MealCardProps } from "./MealCard";
import LoadingSkeleton from "./LoadingSkeleton";

export type WeekPlannerGridProps = {
  meals: (MealCardProps | null)[];
  onSwapClick?: (dayIndex: number) => void;
  onGenerateClick?: (dayIndex: number) => void;
  onAddSavedRecipeClick?: (dayIndex: number) => void;
  generatingDayIndex?: number | null;
  onDeleteClick?: (dayIndex: number) => void;
  isGeneratingPlan?: boolean;
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Now using shared LoadingSkeleton component with ARIA support

export default function WeekPlannerGrid({ meals, onSwapClick, onGenerateClick, onAddSavedRecipeClick, generatingDayIndex, onDeleteClick, isGeneratingPlan }: WeekPlannerGridProps) {
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
          {DAYS.map((day, index) => (
            <div key={day} style={{ display: "flex", flexDirection: "column", gap: "8px", height: "100%" }}>
              <Typography variant="h4">{day}</Typography>
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                {isGeneratingPlan ? (
                  <LoadingSkeleton ariaLabel={`Loading recipe for ${day}`} />
                ) : meals[index] ? (
                  <MemoizedMealCard 
                    {...meals[index]!} 
                    onSwapClick={onSwapClick ? () => onSwapClick(index) : undefined}
                    onDeleteClick={onDeleteClick ? () => onDeleteClick(index) : undefined}
                  />
                ) : generatingDayIndex === index ? (
                  <LoadingSkeleton ariaLabel={`Generating AI recipe for ${day}`} />
                ) : (
                  <Box 
                    borderRadius="4"
                    p="xl"
                    bg="surface"
                    border="subtle"
                    minHeight="200px"
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
                    <Box width="100%">
                      <Stack direction="row" gap="sm" justifyContent="center">
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
                            disabled={generatingDayIndex === index}
                          >
                            {generatingDayIndex === index ? 'Generating...' : 'Generate with AI'}
                          </Button>
                        )}
                      </Stack>
                    </Box>
                  </Box>
                )}
              </div>
            </div>
          ))}
        </ResponsiveGrid>
      </Stack>
    </Box>
  );
}