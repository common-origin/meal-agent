"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Stack, Typography } from "@common-origin/design-system";
import WeekPlannerGrid from "@/components/app/WeekPlannerGrid";
import BudgetBar from "@/components/app/BudgetBar";
import WeeklyOverridesSheet from "@/components/app/WeeklyOverridesSheet";
import SwapDrawer from "@/components/app/SwapDrawer";
import { type MealCardProps } from "@/components/app/MealCard";
import { type Recipe } from "@/lib/types/recipe";
import { scheduleSundayToast, isSaturdayAfter4, nextWeekMondayISO } from "@/lib/schedule";
import { loadHousehold, getDefaultHousehold, loadWeeklyOverrides } from "@/lib/storage";
import { composeWeek, getSuggestedSwaps } from "@/lib/compose";
import { MockLibrary } from "@/lib/library.mock";
import { track } from "@/lib/analytics";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function PlanPage() {
  const [showOverridesSheet, setShowOverridesSheet] = useState(false);
  const [showSaturdayBanner] = useState(() => isSaturdayAfter4());
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [weekPlan, setWeekPlan] = useState<(MealCardProps | null)[]>([]);
  const [budget, setBudget] = useState({ current: 0, total: 120 });
  const [swapDayIndex, setSwapDayIndex] = useState<number | null>(null);
  const [suggestedSwaps, setSuggestedSwaps] = useState<Recipe[]>([]);

  useEffect(() => {
    track('page_view', { page: '/plan' });
    scheduleSundayToast();
    
    // Generate week plan using composeWeek
    const household = loadHousehold() || getDefaultHousehold();
    const nextWeekISO = nextWeekMondayISO();
    const overrides = loadWeeklyOverrides(nextWeekISO);
    
    const plan = composeWeek(household, overrides || undefined);
    
    // Convert PlanWeek to MealCardProps array
    const meals: (MealCardProps | null)[] = [];
    
    for (let i = 0; i < 7; i++) {
      const planDay = plan.days.find((d, idx) => idx === i);
      if (planDay) {
        const recipe = MockLibrary.getById(planDay.recipeId);
        if (recipe) {
          // Generate reasons for this meal
          const reasons: string[] = [];
          if (recipe.timeMins && recipe.timeMins <= 40) reasons.push("≤40m");
          if (recipe.tags.includes("kid_friendly")) reasons.push("kid-friendly");
          if (recipe.tags.includes("bulk_cook")) reasons.push("bulk cook");
          if (household.favorites.includes(recipe.id)) reasons.push("favorite");
          if (recipe.costPerServeEst && recipe.costPerServeEst < 4) reasons.push("best value");
          
          meals.push({
            recipeId: recipe.id,
            title: recipe.title,
            chef: recipe.source.chef === "jamie_oliver" ? "Jamie Oliver" : "RecipeTin Eats",
            timeMins: recipe.timeMins || 0,
            kidsFriendly: recipe.tags.includes("kid_friendly"),
            conflicts: [],
            reasons
          });
        } else {
          meals.push(null);
        }
      } else {
        meals.push(null);
      }
    }
    
    setWeekPlan(meals);
    setBudget({ current: plan.costEstimate, total: 120 });
  }, []);

  const handleOverridesSuccess = () => {
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);
  };

  const handleSwapClick = (dayIndex: number) => {
    const meal = weekPlan[dayIndex];
    if (!meal) return;
    
    const household = loadHousehold() || getDefaultHousehold();
    const isWeekend = dayIndex >= 5; // Saturday or Sunday
    const kidFriendly = household.diet.glutenLight || true; // Use household preference
    
    const swaps = getSuggestedSwaps(meal.recipeId, isWeekend, kidFriendly);
    setSuggestedSwaps(swaps);
    setSwapDayIndex(dayIndex);
  };

  const handleSelectSwap = (recipe: Recipe) => {
    if (swapDayIndex === null) return;
    
    track('swap', { 
      day: DAYS[swapDayIndex],
      oldRecipeId: weekPlan[swapDayIndex]?.recipeId,
      newRecipeId: recipe.id 
    });
    
    const household = loadHousehold() || getDefaultHousehold();
    
    // Generate reasons for the new meal
    const reasons: string[] = [];
    if (recipe.timeMins && recipe.timeMins <= 40) reasons.push("≤40m");
    if (recipe.tags.includes("kid_friendly")) reasons.push("kid-friendly");
    if (recipe.tags.includes("bulk_cook")) reasons.push("bulk cook");
    if (household.favorites.includes(recipe.id)) reasons.push("favorite");
    if (recipe.costPerServeEst && recipe.costPerServeEst < 4) reasons.push("best value");
    
    const newMeal: MealCardProps = {
      recipeId: recipe.id,
      title: recipe.title,
      chef: recipe.source.chef === "jamie_oliver" ? "Jamie Oliver" : "RecipeTin Eats",
      timeMins: recipe.timeMins || 0,
      kidsFriendly: recipe.tags.includes("kid_friendly"),
      conflicts: [],
      reasons
    };
    
    // Update the meal plan
    const newWeekPlan = [...weekPlan];
    const oldMeal = newWeekPlan[swapDayIndex];
    newWeekPlan[swapDayIndex] = newMeal;
    setWeekPlan(newWeekPlan);
    
    // Update budget
    const oldCost = oldMeal ? (MockLibrary.getById(oldMeal.recipeId)?.costPerServeEst || 0) * 4 : 0;
    const newCost = (recipe.costPerServeEst || 0) * 4;
    const budgetDiff = newCost - oldCost;
    setBudget(prev => ({ ...prev, current: prev.current + budgetDiff }));
    
    // Close drawer
    setSwapDayIndex(null);
  };

  return (
    <main style={{ padding: 24 }}>
      <Stack direction="column" gap="xl">
        <Typography variant="h1">Weekly Meal Plan</Typography>

        {/* Saturday Banner for Weekly Overrides */}
        {showSaturdayBanner && (
          <div style={{
            padding: "16px",
            backgroundColor: "#fff3cd",
            border: "1px solid #ffc107",
            borderRadius: "8px"
          }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="column" gap="xs">
                <Typography variant="h4">Plan for next week</Typography>
                <Typography variant="body">
                  Update your preferences for next week&apos;s meal plan
                </Typography>
              </Stack>
              <button
                onClick={() => setShowOverridesSheet(true)}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#007bff",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  whiteSpace: "nowrap"
                }}
              >
                Update next week inputs
              </button>
            </Stack>
          </div>
        )}

        {/* Success Toast */}
        {showSuccessToast && (
          <div style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            padding: "16px 24px",
            backgroundColor: "#28a745",
            color: "white",
            borderRadius: "8px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            zIndex: 100
          }}>
            <Typography variant="body">Overrides saved for next week ✓</Typography>
          </div>
        )}
        
        <BudgetBar 
          currentSpend={budget.current}
          budget={budget.total}
        />
        
        <WeekPlannerGrid 
          meals={weekPlan} 
          onSwapClick={handleSwapClick}
        />
        
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

      <WeeklyOverridesSheet
        isOpen={showOverridesSheet}
        onClose={() => setShowOverridesSheet(false)}
        onSuccess={handleOverridesSuccess}
      />

      <SwapDrawer
        isOpen={swapDayIndex !== null}
        onClose={() => setSwapDayIndex(null)}
        dayName={swapDayIndex !== null ? DAYS[swapDayIndex] : ""}
        currentRecipe={
          swapDayIndex !== null && weekPlan[swapDayIndex]
            ? MockLibrary.getById(weekPlan[swapDayIndex]!.recipeId)
            : null
        }
        suggestedSwaps={suggestedSwaps}
        onSelectSwap={handleSelectSwap}
      />
    </main>
  );
}