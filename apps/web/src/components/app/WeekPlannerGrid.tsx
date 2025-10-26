import { Stack, Typography } from "@common-origin/design-system";
import MealCard, { type MealCardProps } from "./MealCard";

export type WeekPlannerGridProps = {
  meals: (MealCardProps | null)[];
  onMealSwap?: (dayIndex: number, meal: MealCardProps | null) => void;
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function WeekPlannerGrid({ meals, onMealSwap }: WeekPlannerGridProps) {
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
              <MealCard {...meals[index]!} />
            ) : (
              <div style={{
                border: "2px dashed #dee2e6",
                borderRadius: "8px",
                padding: "32px",
                textAlign: "center",
                backgroundColor: "#f8f9fa"
              }}>
                <Typography variant="body">
                  No meal planned
                </Typography>
              </div>
            )}
          </Stack>
        ))}
      </div>
    </Stack>
  );
}