import { Stack, Typography, Button, ResponsiveGrid, Box } from "@common-origin/design-system";
import MealCard, { type MealCardProps } from "./MealCard";

export type WeekPlannerGridProps = {
  meals: (MealCardProps | null)[];
  onSwapClick?: (dayIndex: number) => void;
  onGenerateClick?: (dayIndex: number) => void;
  generatingDayIndex?: number | null;
  onDeleteClick?: (dayIndex: number) => void;
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function WeekPlannerGrid({ meals, onSwapClick, onGenerateClick, generatingDayIndex, onDeleteClick }: WeekPlannerGridProps) {
  return (
    <Stack direction="column" gap="lg">
      <Typography variant="h2">This Week&apos;s Dinners</Typography>
      
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
              {meals[index] ? (
                <MealCard 
                  {...meals[index]!} 
                  onSwapClick={onSwapClick ? () => onSwapClick(index) : undefined}
                  onDeleteClick={onDeleteClick ? () => onDeleteClick(index) : undefined}
                />
              ) : (
                <Box 
                  borderRadius="3"
                  p="xl"
                  bg="surface"
                  style={{
                    border: "1px dashed #a7a8a8ff",
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                    alignItems: "center",
                    flex: 1,
                    justifyContent: "center",
                    textAlign: "center"
                  }}
                >
                  <Typography variant="label" color="subdued">
                    No meal planned
                  </Typography>
                  {onGenerateClick && (
                    <Button
                      variant="primary"
                      size="medium"
                      onClick={() => onGenerateClick(index)}
                      disabled={generatingDayIndex === index}
                    >
                      {generatingDayIndex === index ? 'Generating...' : 'Generate recipe'}
                    </Button>
                  )}
                </Box>
              )}
            </div>
          </div>
        ))}
      </ResponsiveGrid>
    </Stack>
  );
}