import { Stack, Typography, Button } from "@common-origin/design-system";
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
      
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: "16px"
      }}>
        {DAYS.map((day, index) => (
          <Stack key={day} direction="column" gap="sm">
            <Typography variant="h4">{day}</Typography>
            {meals[index] ? (
              <MealCard 
                {...meals[index]!} 
                onSwapClick={onSwapClick ? () => onSwapClick(index) : undefined}
                onDeleteClick={onDeleteClick ? () => onDeleteClick(index) : undefined}
              />
            ) : (
              <div style={{
                border: "2px dashed #dee2e6",
                borderRadius: "8px",
                padding: "32px",
                textAlign: "center",
                backgroundColor: "#f8f9fa",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                alignItems: "center"
              }}>
                <Typography variant="body" color="subdued">
                  No meal planned
                </Typography>
                {onGenerateClick && (
                  <Button
                    variant="primary"
                    size="small"
                    onClick={() => onGenerateClick(index)}
                    disabled={generatingDayIndex === index}
                  >
                    {generatingDayIndex === index ? '✨ Generating...' : '✨ Generate Recipe'}
                  </Button>
                )}
              </div>
            )}
          </Stack>
        ))}
      </div>
    </Stack>
  );
}