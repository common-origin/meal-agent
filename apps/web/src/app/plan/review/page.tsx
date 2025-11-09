"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Stack, Typography, Button, ProgressBar, ResponsiveGrid, Box } from "@common-origin/design-system";
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
import { getRecipeSourceDisplay } from "@/lib/recipeDisplay";

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
            chef: getRecipeSourceDisplay(recipe),
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
          <Typography variant="h1">Review your meal plan</Typography>
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
            style={{ flex: "1 1 200px" }}
          >
            <Box bg="emphasis" p="lg" borderRadius="3" minHeight="120px">
              <Stack direction="column" gap="xs">
                <Typography variant="h4" color="inverse">Total cost</Typography>
                <Typography variant="h2" color="inverse">${plan.costEstimate.toFixed(2)}</Typography>
                <Typography variant="small" color="inverse">
                  ${(plan.costEstimate / plan.days.length).toFixed(2)} per meal
                </Typography>
              </Stack>
            </Box>
          </div>

          <div 
            role="article"
            aria-label={`Weeknight constraint: ${weeknightsMeetConstraint} out of ${weeknightCount} weeknight meals are 40 minutes or less`}
            style={{ flex: "1 1 200px" }}
          >
            <Box bg="emphasis" p="lg" borderRadius="3" minHeight="120px">
              <Stack direction="column" gap="xs">
                <Typography variant="h4" color="inverse">Weeknight constraint</Typography>
                <Typography variant="h2" color="inverse">
                  {weeknightsMeetConstraint}/{weeknightCount}
                </Typography>
                <Typography variant="small" color="inverse">Meals ≤40 minutes</Typography>
              </Stack>
            </Box>
          </div>

          <div 
            role="article"
            aria-label={`${kidFriendlyCount} out of ${totalDays} meals are kid-friendly`}
            style={{ flex: "1 1 200px" }}
          >
            <Box bg="emphasis" p="lg" borderRadius="3" minHeight="120px">
              <Stack direction="column" gap="xs">
                <Typography variant="h4" color="inverse">Kid-friendly</Typography>
                <Typography variant="h2" color="inverse">
                  {kidFriendlyCount}/{totalDays}
                </Typography>
                <Typography variant="small" color="inverse">Meals kid-friendly</Typography>
              </Stack>
            </Box>
          </div>

          <div 
            role="article"
            aria-label={`${reusedIngredients} ingredients are used in 2 or more meals`}
            style={{ flex: "1 1 200px" }}
          >
            <Box bg="emphasis" p="lg" borderRadius="3" minHeight="120px">
              <Stack direction="column" gap="xs">
                <Typography variant="h4" color="inverse">Ingredient reuse</Typography>
                <Typography variant="h2" color="inverse">{reusedIngredients}</Typography>
                <Typography variant="small" color="inverse">Ingredients used 2+ times</Typography>
              </Stack>
            </Box>
          </div>
        </div>

        {/* Conflicts */}
        {plan.conflicts.length > 0 && (
          <Alert variant="warning" title="Plan conflicts">
            <Stack direction="column" gap="xs">
              {plan.conflicts.map((conflict, idx) => (
                <Typography key={idx} variant="body">
                  • {conflict}
                </Typography>
              ))}
            </Stack>
          </Alert>
        )}

        {/* Meal Grid */}

        <ResponsiveGrid 
          cols={1} 
          colsSm={2} 
          colsMd={3} 
          colsLg={4}
          gapX={4}
          gapY={8}
        >
          {meals.map((meal, index) => {
            if (!meal) return null;
            
            const planDay = plan.days[index];
            const isLeftover = planDay?.notes?.includes("Leftovers");
            
            if (isLeftover && index > 0) {
              const prevMeal = meals[index - 1];
              return (
                <div key={index} style={{ display: "flex", flexDirection: "column", gap: "8px", height: "100%" }}>
                  <Typography variant="h4">{DAYS[index]}</Typography>
                  <LeftoverCard
                    originalRecipeTitle={prevMeal?.title || ""}
                    originalDay={DAYS[index - 1]}
                  />
                </div>
              );
            }
            
            return (
              <div key={index} style={{ display: "flex", flexDirection: "column", gap: "8px", height: "100%" }}>
                <Typography variant="h4">{DAYS[index]}</Typography>
                <MealCard 
                  {...meal}
                />
              </div>
            );
          })}
        </ResponsiveGrid>

        {/* Actions */}
        <Stack direction="row" gap="md" justifyContent="flex-end">
          <Button
            variant="secondary"
            size="large"
            iconName="arrowLeft"
            onClick={() => router.push('/plan')}
            aria-label="Go back to plan overview page"
          >
            Back to plan
          </Button>
          <Button
            variant="secondary"
            size="large"
            onClick={() => setShowRegenerateDrawer(true)}
            aria-label="Open regenerate drawer to customize meal plan with constraints"
          >
            Regenerate with constraints
          </Button>
          <Button
            variant="primary"
            size="large"
            iconName="check"
            purpose="link"
            url="/shopping-list"
            onClick={handleConfirm}
            aria-label="Confirm meal plan and view shopping list"
          >
            Confirm & view Shopping List
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
