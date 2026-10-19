"use client";

import { Sheet, Stack, Typography, Box, ProgressBar, IconButton } from "@common-origin/design-system";
import BudgetSummary from "./BudgetSummary";
import type { MealCardProps } from "./MealCard";
import type { PlanSummary } from "@/lib/planSummary";

type PlanDetailsSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  weekPlan: (MealCardProps | null)[];
  summary: PlanSummary;
  dayNames: string[];
};

// Bars are scaled against a generous per-serve dinner, as the review page did.
const NUTRIENTS = [
  { key: 'calories', label: 'Calories', unit: '', max: 800 },
  { key: 'protein', label: 'Protein', unit: 'g', max: 50 },
  { key: 'carbs', label: 'Carbs', unit: 'g', max: 80 },
  { key: 'fat', label: 'Fat', unit: 'g', max: 40 },
] as const;

/** The full budget and nutrition breakdown behind the plan's summary line (#38). */
export default function PlanDetailsSheet({ isOpen, onClose, weekPlan, summary, dayNames }: PlanDetailsSheetProps) {
  if (!isOpen) return null;
  const { nutrition } = summary;

  return (
    <Sheet isOpen={isOpen} onClose={onClose} position="right" width="560px" title="Plan details">
      <Stack direction="column" gap="xl">
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h2">Plan details</Typography>
          <IconButton variant="naked" iconName="close" size="medium" onClick={onClose} aria-label="Close plan details" />
        </Stack>

        <BudgetSummary
          weekPlan={weekPlan}
          budget={{ current: summary.cost, total: summary.budget }}
          dayNames={dayNames}
        />

        <Box border="subtle" borderRadius="lg" p="lg">
          <Stack direction="column" gap="md">
            <Typography variant="h3">Average nutrition per serve</Typography>
            {nutrition ? (
              <>
                <Typography variant="small" color="subdued">
                  Based on {nutrition.meals} of {summary.dinners} {summary.dinners === 1 ? 'dinner' : 'dinners'} with nutrition data.
                </Typography>
                {NUTRIENTS.map(({ key, label, unit, max }) => (
                  <Stack key={key} direction="column" gap="xs">
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="label">{label}</Typography>
                      <Typography variant="label">
                        {nutrition[key]}
                        {unit}
                      </Typography>
                    </Stack>
                    <ProgressBar
                      value={Math.min((nutrition[key] / max) * 100, 100)}
                      aria-label={`Average ${nutrition[key]}${unit} ${label.toLowerCase()} per serve`}
                    />
                  </Stack>
                ))}
              </>
            ) : (
              <Typography variant="small" color="subdued">
                No nutrition data for this week&apos;s dinners yet.
              </Typography>
            )}
          </Stack>
        </Box>
      </Stack>
    </Sheet>
  );
}
