import { Stack, Typography } from "@common-origin/design-system";

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
      
      <div style={{
        width: "100%",
        height: "8px",
        backgroundColor: "#e9ecef",
        borderRadius: "4px",
        overflow: "hidden"
      }}>
        <div style={{
          width: `${percentage}%`,
          height: "100%",
          backgroundColor: isOverBudget ? "#dc3545" : "#28a745",
          transition: "width 0.3s ease"
        }} />
      </div>
      
      {isOverBudget && (
        <Typography variant="small">
          ⚠️ Over budget by {currency}{(currentSpend - budget).toFixed(2)}
        </Typography>
      )}
    </Stack>
  );
}