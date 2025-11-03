"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Stack, Typography, Button, ProgressBar } from "@common-origin/design-system";
import MealCard from "@/components/app/MealCard";
import LeftoverCard from "@/components/app/LeftoverCard";
import RegenerateDrawer from "@/components/app/RegenerateDrawer";
import { type PlanWeek } from "@/lib/types/recipe";
import { type MealCardProps } from "@/components/app/MealCard";
import { loadHousehold, getDefaultHousehold, loadWeeklyOverrides, loadCurrentWeekPlan } from "@/lib/storage";
import { composeWeek } from "@/lib/compose";
import { RecipeLibrary } from "@/lib/library";
import { nextWeekMondayISO } from "@/lib/schedule";
import { track, type PlanComposedMeta, type PlanRegeneratedMeta } from "@/lib/analytics";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function PlanReviewPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<PlanWeek | null>(null);
  const [meals, setMeals] = useState<(MealCardProps | null)[]>([]);
  const [showRegenerateDrawer, setShowRegenerateDrawer] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    track('page_view', { page: '/plan/review' });
    track('plan_reviewed');
    generatePlan();
  }, []);

  const generatePlan = (_pinnedDays?: number[], _constraints?: {
    maxCost?: number;
    maxIngredients?: number;
    preferredChef?: string;
  }) => {
    setLoading(true);
    
    const household = loadHousehold() || getDefaultHousehold();
    const nextWeekISO = nextWeekMondayISO();
    
    // Check if user has a saved week plan (from AI generation or manual selection)
    const savedPlan = loadCurrentWeekPlan(nextWeekISO);
    
    let newPlan: PlanWeek;
    
    if (savedPlan) {
      // Use the saved plan - build PlanWeek from saved recipe IDs
      console.log('📋 Review page: Using saved week plan:', savedPlan.recipeIds);
      
      // Calculate dates for the week (Monday through Sunday)
      const startDate = new Date(nextWeekISO);
      
      const days = savedPlan.recipeIds.map((recipeId, index) => {
        if (!recipeId) return null;
        
        const recipe = RecipeLibrary.getById(recipeId);
        if (!recipe) {
          console.warn(`Recipe ${recipeId} not found in library`);
          return null;
        }
        
        // Calculate date for this day
        const dayDate = new Date(startDate);
        dayDate.setDate(dayDate.getDate() + index);
        
        // Generate reasons for this meal
        const reasons: string[] = [];
        if (recipe.timeMins && recipe.timeMins <= 40) reasons.push("≤40m");
        if (recipe.tags.includes("kid_friendly")) reasons.push("kid-friendly");
        if (recipe.tags.includes("bulk_cook")) reasons.push("bulk cook");
        if (household.favorites.includes(recipe.id)) reasons.push("favorite");
        if (recipe.costPerServeEst && recipe.costPerServeEst < 4) reasons.push("best value");
        
        return {
          dateISO: dayDate.toISOString().split('T')[0],
          recipeId: recipe.id,
          scaledServings: recipe.serves || 4,
          reasons,
        };
      }).filter((day): day is { dateISO: string; recipeId: string; scaledServings: number; reasons: string[] } => day !== null);
      
      // Calculate cost estimate
      const costEstimate = days.reduce((sum, day) => {
        const recipe = RecipeLibrary.getById(day.recipeId);
        return sum + ((recipe?.costPerServeEst || 0) * day.scaledServings);
      }, 0);
      
      newPlan = {
        startISO: nextWeekISO,
        days,
        costEstimate,
        conflicts: [],
      };
      
      console.log('✅ Review page: Built plan from saved recipe IDs:', days.length, 'meals');
    } else {
      // Fall back to auto-composition from library
      console.log('🔄 Review page: No saved plan found, composing from library...');
      const overrides = loadWeeklyOverrides(nextWeekISO);
      newPlan = composeWeek(household, overrides || undefined);
    }
    
    setPlan(newPlan);
    
    // Convert to MealCardProps
    const newMeals: (MealCardProps | null)[] = [];
    
    for (let i = 0; i < 7; i++) {
      const planDay = newPlan.days.find((d, idx) => idx === i);
      if (planDay) {
        const recipe = RecipeLibrary.getById(planDay.recipeId);
        if (recipe) {
          newMeals.push({
            recipeId: recipe.id,
            title: recipe.title,
            chef: recipe.source.chef === "jamie_oliver" ? "Jamie Oliver" : "RecipeTin Eats",
            timeMins: recipe.timeMins || 0,
            kidsFriendly: recipe.tags.includes("kid_friendly"),
            conflicts: [],
            reasons: planDay.reasons || []
          });
        } else {
          newMeals.push(null);
        }
      } else {
        newMeals.push(null);
      }
    }
    
    setMeals(newMeals);
    setLoading(false);
    
    // Track plan composition
    const leftoverDays = newPlan.days.filter(d => d.notes?.includes('Leftovers')).length;
    const proteinTypes = new Set(
      newPlan.days.map(d => {
        const recipe = RecipeLibrary.getById(d.recipeId);
        return recipe?.tags.find(t => ['chicken', 'beef', 'pork', 'fish', 'vegetarian'].includes(t));
      }).filter(Boolean)
    );
    
    const composedMeta: PlanComposedMeta = {
      dayCount: newPlan.days.length,
      cost: newPlan.costEstimate,
      conflicts: newPlan.conflicts.length,
      leftoverDays,
      proteinVariety: proteinTypes.size
    };
    
    track('plan_composed', composedMeta);
  };

  const handleRegenerate = (pinnedDays: number[], constraints: { maxCost?: number; maxIngredients?: number; preferredChef?: string; }) => {
    const previousCost = plan?.costEstimate;
    
    // Track regeneration
    const regenMeta: PlanRegeneratedMeta = {
      pinnedDays,
      constraints: {
        maxCost: constraints.maxCost,
        maximizeReuse: false,
        kidFriendlyOnly: false
      },
      previousCost
    };
    
    track('plan_regenerated', regenMeta);
    
    generatePlan(pinnedDays, constraints);
    setShowRegenerateDrawer(false);
  };

  const handleConfirm = () => {
    track('plan_confirmed', {
      finalCost: plan?.costEstimate,
      dayCount: plan?.days.length
    });
    router.push('/shopping-list');
  };

  if (loading || !plan) {
    return (
      <main style={{ padding: 24 }}>
        <Stack direction="column" gap="xl" alignItems="center">
          <Typography variant="h1">Generating your plan...</Typography>
          <ProgressBar value={50} variant="horizontal" color="default" />
        </Stack>
      </main>
    );
  }

  // Calculate summary stats
  const totalDays = plan.days.length;
  const weeknightCount = plan.days.filter((d, i) => i < 5).length;
  const weeknightsMeetConstraint = plan.days.filter((d, i) => {
    if (i >= 5) return true; // Weekend, no constraint
    const recipe = RecipeLibrary.getById(d.recipeId);
    return recipe && (recipe.timeMins || 30) <= 40;
  }).length;
  
  const kidFriendlyCount = plan.days.filter(d => {
    const recipe = RecipeLibrary.getById(d.recipeId);
    return recipe?.tags.includes("kid_friendly");
  }).length;

  // Count ingredient reuse
  const ingredientCounts: Record<string, number> = {};
  plan.days.forEach(d => {
    const recipe = RecipeLibrary.getById(d.recipeId);
    if (recipe) {
      recipe.ingredients.forEach(ing => {
        const name = ing.name.toLowerCase().split(" ").slice(0, 2).join(" ");
        ingredientCounts[name] = (ingredientCounts[name] || 0) + 1;
      });
    }
  });
  const reusedIngredients = Object.entries(ingredientCounts)
    .filter(([, count]) => count >= 2)
    .length;

  return (
    <main style={{ padding: 24 }}>
      <Stack direction="column" gap="xl">
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h1">Review Your Meal Plan</Typography>
          <Button
            variant="secondary"
            size="medium"
            onClick={() => router.push('/plan')}
            aria-label="Go back to plan overview page"
          >
            ← Back to Plan
          </Button>
        </Stack>

        {/* Summary Cards */}
        <div 
          role="region" 
          aria-label="Meal plan summary statistics"
          style={{ 
            display: "flex", 
            flexDirection: "row", 
            gap: "16px", 
            flexWrap: "wrap" 
          }}
        >
          <div 
            role="article"
            aria-label={`Total cost: $${plan.costEstimate.toFixed(2)}, which is $${(plan.costEstimate / plan.days.length).toFixed(2)} per meal`}
            style={{
              flex: "1 1 200px",
              minHeight: "120px",
              padding: "16px",
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              backgroundColor: "#f9f9f9"
            }}
          >
            <Typography variant="h4">Total Cost</Typography>
            <Typography variant="h2">${plan.costEstimate.toFixed(2)}</Typography>
            <Typography variant="small">
              ${(plan.costEstimate / plan.days.length).toFixed(2)} per meal
            </Typography>
          </div>

          <div 
            role="article"
            aria-label={`Weeknight constraint: ${weeknightsMeetConstraint} out of ${weeknightCount} weeknight meals are 40 minutes or less`}
            style={{
              flex: "1 1 200px",
              minHeight: "120px",
              padding: "16px",
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              backgroundColor: "#f9f9f9"
            }}
          >
            <Typography variant="h4">Weeknight Constraint</Typography>
            <Typography variant="h2">
              {weeknightsMeetConstraint}/{weeknightCount}
            </Typography>
            <Typography variant="small">Meals ≤40 minutes</Typography>
          </div>

          <div 
            role="article"
            aria-label={`${kidFriendlyCount} out of ${totalDays} meals are kid-friendly`}
            style={{
              flex: "1 1 200px",
              minHeight: "120px",
              padding: "16px",
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              backgroundColor: "#f9f9f9"
            }}
          >
            <Typography variant="h4">Kid-Friendly</Typography>
            <Typography variant="h2">
              {kidFriendlyCount}/{totalDays}
            </Typography>
            <Typography variant="small">Meals kid-friendly</Typography>
          </div>

          <div 
            role="article"
            aria-label={`${reusedIngredients} ingredients are used in 2 or more meals`}
            style={{
              flex: "1 1 200px",
              minHeight: "120px",
              padding: "16px",
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              backgroundColor: "#f9f9f9"
            }}
          >
            <Typography variant="h4">Ingredient Reuse</Typography>
            <Typography variant="h2">{reusedIngredients}</Typography>
            <Typography variant="small">Ingredients used 2+ times</Typography>
          </div>
        </div>

        {/* Conflicts */}
        {plan.conflicts.length > 0 && (
          <div 
            role="alert"
            aria-live="polite"
            style={{
              padding: "16px",
              backgroundColor: "#fff3cd",
              border: "1px solid #ffc107",
              borderRadius: "8px"
            }}
          >
            <Typography variant="h4">
              <span role="img" aria-label="Warning">⚠️</span> Plan Conflicts
            </Typography>
            <Stack direction="column" gap="xs">
              {plan.conflicts.map((conflict, idx) => (
                <Typography key={idx} variant="body">
                  • {conflict}
                </Typography>
              ))}
            </Stack>
          </div>
        )}

        {/* Meal Grid */}
        <div>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h2">Your Weekly Meals</Typography>
            <Button
              variant="secondary"
              size="medium"
              onClick={() => setShowRegenerateDrawer(true)}
              aria-label="Open regenerate drawer to customize meal plan with constraints"
            >
              <span role="img" aria-label="Settings">⚙️</span> Regenerate with Constraints
            </Button>
          </Stack>
        </div>

        <div 
          role="region"
          aria-label="7-day meal grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "16px"
          }}
        >
          {meals.map((meal, index) => {
            if (!meal) return null;
            
            const planDay = plan.days[index];
            const isLeftover = planDay?.notes?.includes("Leftovers");
            
            if (isLeftover && index > 0) {
              const prevMeal = meals[index - 1];
              return (
                <article key={index} aria-label={`${DAYS[index]}: Leftovers meal`}>
                  <div style={{ marginBottom: "8px" }}>
                    <Typography variant="small">
                      <strong>{DAYS[index]}</strong>
                    </Typography>
                  </div>
                  <LeftoverCard
                    originalRecipeTitle={prevMeal?.title || ""}
                    originalDay={DAYS[index - 1]}
                  />
                </article>
              );
            }
            
            return (
              <article key={index} aria-label={`${DAYS[index]}: ${meal.title}`}>
                <div style={{ marginBottom: "8px" }}>
                  <Typography variant="small">
                    <strong>{DAYS[index]}</strong>
                  </Typography>
                </div>
                <MealCard {...meal} />
              </article>
            );
          })}
        </div>

        {/* Actions */}
        <Stack direction="row" gap="md" justifyContent="flex-end">
          <Button
            variant="secondary"
            size="large"
            onClick={() => setShowRegenerateDrawer(true)}
            aria-label="Regenerate meal plan with different constraints"
          >
            Regenerate Plan
          </Button>
          <Button
            variant="primary"
            size="large"
            purpose="link"
            url="/shopping-list"
            onClick={handleConfirm}
            aria-label="Confirm meal plan and view shopping list"
          >
            Confirm & View Shopping List →
          </Button>
        </Stack>
      </Stack>

      {/* Regenerate Drawer */}
      <RegenerateDrawer
        isOpen={showRegenerateDrawer}
        onClose={() => setShowRegenerateDrawer(false)}
        onRegenerate={handleRegenerate}
        currentPlan={plan}
      />
    </main>
  );
}
