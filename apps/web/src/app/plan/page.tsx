"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Stack, Typography } from "@common-origin/design-system";
import WeekPlannerGrid from "@/components/app/WeekPlannerGrid";
import BudgetBar from "@/components/app/BudgetBar";
import { MOCK_WEEK_PLAN, MOCK_BUDGET } from "@/lib/mockData";
import { scheduleSundayToast } from "@/lib/schedule";

export default function PlanPage() {
  useEffect(() => {
    scheduleSundayToast();
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <Stack direction="column" gap="xl">
        <Typography variant="h1">Weekly Meal Plan</Typography>
        
        <BudgetBar 
          currentSpend={MOCK_BUDGET.current}
          budget={MOCK_BUDGET.total}
        />
        
        <WeekPlannerGrid meals={MOCK_WEEK_PLAN} />
        
        <Stack direction="row" gap="md">
          <Link href="/shopping-list">
            <button style={{
              padding: "12px 24px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "16px"
            }}>
              Lock Plan & View Shopping List
            </button>
          </Link>
        </Stack>
      </Stack>
    </main>
  );
}