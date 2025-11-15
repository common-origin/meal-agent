import { Stack, Typography, Button, ResponsiveGrid, Box } from "@common-origin/design-system";
import { tokens } from "@common-origin/design-system/tokens";
import MealCard, { type MealCardProps } from "./MealCard";

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

// Skeleton loader component for meal cards
const MealCardSkeleton = () => (
  <Box 
    borderRadius="3"
    p="xl"
    bg="default"
    border="subtle"
    gap="lg"
    style={{
      display: "flex",
      flexDirection: "column",
      flex: 1
    }}
  >
    <div 
      style={{ 
        height: "24px", 
        backgroundColor: tokens.semantic.color.background.disabled, 
        borderRadius: "4px", 
        width: "80%",
        animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
      }} 
    />
    <div 
      style={{ 
        height: "16px", 
        backgroundColor: tokens.semantic.color.background.disabled, 
        borderRadius: "4px", 
        width: "40%",
        animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        animationDelay: "0.1s"
      }} 
    />
    <div 
      style={{ 
        height: "16px", 
        backgroundColor: tokens.semantic.color.background.disabled, 
        borderRadius: "4px", 
        width: "60%",
        animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        animationDelay: "0.2s"
      }} 
    />
    <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
      <div 
        style={{ 
          height: "24px", 
          backgroundColor: tokens.semantic.color.background.disabled, 
          borderRadius: "12px", 
          width: "60px",
          animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
          animationDelay: "0.3s"
        }} 
      />
      <div 
        style={{ 
          height: "24px", 
          backgroundColor: tokens.semantic.color.background.disabled, 
          borderRadius: "12px", 
          width: "80px",
          animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
          animationDelay: "0.4s"
        }} 
      />
    </div>
    <style dangerouslySetInnerHTML={{__html: `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `}} />
  </Box>
);

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
                  <MealCardSkeleton />
                ) : meals[index] ? (
                  <MealCard 
                    {...meals[index]!} 
                    onSwapClick={onSwapClick ? () => onSwapClick(index) : undefined}
                    onDeleteClick={onDeleteClick ? () => onDeleteClick(index) : undefined}
                  />
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