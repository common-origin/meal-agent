import { Stack, Typography, ProgressBar } from "@common-origin/design-system";

export type BudgetBarProps = {
  currentSpend: number;
  budget: number;
  currency?: string;
};

export default function BudgetBar({ 
  currentSpend, 
  budget, 
  currency = "$" 
}: BudgetBarProps) {
  const percentage = Math.min((currentSpend / budget) * 100, 100);
  const isOverBudget = currentSpend > budget;
  
  return (
    <Stack direction="column" gap="sm">
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h3">Weekly Budget</Typography>
        <Typography variant="body">
          {currency}{currentSpend.toFixed(2)} / {currency}{budget.toFixed(2)}
        </Typography>
      </Stack>
      
      <ProgressBar
        value={percentage}
        color={isOverBudget ? "error" : "success"}
        height="md"
      />
      
      {isOverBudget && (
        <Typography variant="small">
          ⚠️ Over budget by {currency}{(currentSpend - budget).toFixed(2)}
        </Typography>
      )}
    </Stack>
  );
}