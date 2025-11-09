"use client";

import { useEffect, useState } from "react";
import { Alert, Badge, Stack, Typography, Button } from "@common-origin/design-system";
import WeekPlannerGrid from "@/components/app/WeekPlannerGrid";
import BudgetBar from "@/components/app/BudgetBar";
import WeeklyOverridesSheet from "@/components/app/WeeklyOverridesSheet";
import SwapDrawer from "@/components/app/SwapDrawer";
import WeeklyPlanWizard, { type WeeklyPlanData } from "@/components/app/WeeklyPlanWizard";
import PantrySheet from "@/components/app/PantrySheet";
import { type MealCardProps } from "@/components/app/MealCard";
import { type Recipe } from "@/lib/types/recipe";
import { scheduleSundayToast, isSaturdayAfter4, nextWeekMondayISO } from "@/lib/schedule";
import { loadHousehold, getDefaultHousehold, getFamilySettings, saveCurrentWeekPlan, loadCurrentWeekPlan } from "@/lib/storage";
import { getSuggestedSwaps } from "@/lib/compose";
import { RecipeLibrary } from "@/lib/library";
import { track } from "@/lib/analytics";
import { addToRecipeHistory, getRecipeIdsToExclude } from "@/lib/recipeHistory";
import { getRecipeSourceDisplay } from "@/lib/recipeDisplay";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function PlanPage() {
  const [showWizard, setShowWizard] = useState(false);
  const [showOverridesSheet, setShowOverridesSheet] = useState(false);
  const [showPantrySheet, setShowPantrySheet] = useState(false);
  const [showSaturdayBanner] = useState(() => isSaturdayAfter4());
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [weekPlan, setWeekPlan] = useState<(MealCardProps | null)[]>([]);
  const [budget, setBudget] = useState({ current: 0, total: 120 });
  const [swapDayIndex, setSwapDayIndex] = useState<number | null>(null);
  const [suggestedSwaps, setSuggestedSwaps] = useState<Recipe[]>([]);
  const [isGeneratingAISwaps, setIsGeneratingAISwaps] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generatingDayIndex, setGeneratingDayIndex] = useState<number | null>(null);

  
  // Pantry items state
  const [pantryItems, setPantryItems] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    track('page_view', { page: '/plan' });
    scheduleSundayToast();
    
    const household = loadHousehold() || getDefaultHousehold();
    const nextWeekISO = nextWeekMondayISO();
    
    // Check if there's a saved week plan first
    const savedPlan = loadCurrentWeekPlan(nextWeekISO);
    
    if (savedPlan && savedPlan.recipeIds.length > 0) {
      // Use the saved plan
      console.log('📋 Plan page: Loading saved week plan');
      setShowWizard(false);
      
      const meals: (MealCardProps | null)[] = savedPlan.recipeIds.map(recipeId => {
        if (!recipeId) return null;
        
        const recipe = RecipeLibrary.getById(recipeId);
        if (!recipe) {
          console.warn(`Recipe ${recipeId} not found in library`);
          return null;
        }
        
        // Generate reasons for this meal
        const reasons: string[] = [];
        if (recipe.timeMins && recipe.timeMins <= 40) reasons.push("≤40m");
        if (recipe.tags.includes("kid_friendly")) reasons.push("kid-friendly");
        if (recipe.tags.includes("bulk_cook")) reasons.push("bulk cook");
        if (household.favorites.includes(recipe.id)) reasons.push("favorite");
        if (recipe.costPerServeEst && recipe.costPerServeEst < 4) reasons.push("best value");
        
        // Get chef/source display name
        const chefDisplay = getRecipeSourceDisplay(recipe);
        
        return {
          recipeId: recipe.id,
          title: recipe.title,
          chef: chefDisplay,
          timeMins: recipe.timeMins || 0,
          kidsFriendly: recipe.tags.includes("kid_friendly"),
          conflicts: [],
          reasons
        };
      });
      
      // Calculate budget from saved recipes
      const totalCost = savedPlan.recipeIds.reduce((sum, recipeId) => {
        if (!recipeId) return sum;
        const recipe = RecipeLibrary.getById(recipeId);
        return sum + ((recipe?.costPerServeEst || 0) * (recipe?.serves || 4));
      }, 0);
      
      setWeekPlan(meals);
      setBudget({ current: totalCost, total: 120 });
      console.log('✅ Loaded saved week plan with', meals.filter(m => m !== null).length, 'meals');
      
      // Load pantry items if available
      if (savedPlan.pantryItems) {
        setPantryItems(savedPlan.pantryItems);
        console.log('✅ Loaded', savedPlan.pantryItems.length, 'pantry items');
      }
      
    } else {
      // No saved plan - show wizard instead of auto-generating
      console.log('🧙 Plan page: No saved plan, showing wizard');
      setShowWizard(true);
    }
  }, []);

  // Handler for updating pantry items
  const handleUpdatePantryItems = (items: string[]) => {
    setPantryItems(items);
    
    // Save updated pantry items to storage
    const nextWeekISO = nextWeekMondayISO();
    const recipeIds = weekPlan.map(m => m?.recipeId || "");
    saveCurrentWeekPlan(recipeIds, nextWeekISO, items);
    console.log('✅ Pantry items updated and saved');
  };

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

  const handleGenerateAISwaps = async () => {
    if (swapDayIndex === null) return;
    
    setIsGeneratingAISwaps(true);

    try {
      const dayName = DAYS[swapDayIndex];
      console.log(`🤖 Generating AI swap suggestions for ${dayName}...`);
      
      const familySettings = getFamilySettings();
      const dayType = swapDayIndex >= 5 ? 'weekend' : 'weeknight';
      
      // Get existing recipe IDs to avoid duplicates
      const existingRecipeIds = weekPlan
        .filter(meal => meal !== null)
        .map(meal => meal!.recipeId);
      
      // Combine with recipe history to avoid repetition
      const historyIds = getRecipeIdsToExclude();
      const excludeRecipeIds = [...new Set([...existingRecipeIds, ...historyIds])];
      console.log('📚 Excluding', excludeRecipeIds.length, 'recipes from swap generation');
      
      console.log('📡 Calling API for 3 swap suggestions...');
      const response = await fetch('/api/generate-recipes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          familySettings,
          numberOfRecipes: 3,
          excludeRecipeIds,
          specificDays: [{ index: swapDayIndex, type: dayType }],
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        console.error('❌ API error:', data);
        throw new Error(data.error || data.details || `HTTP ${response.status}`);
      }

      if (!data.recipes || data.recipes.length === 0) {
        throw new Error('No recipes generated');
      }

      console.log('✅ Generated', data.recipes.length, 'AI swap suggestions');

      // Save to library
      RecipeLibrary.addCustomRecipes(data.recipes);
      console.log('✅ AI swaps saved to library');
      
      // Add to recipe history
      const newRecipeIds = data.recipes.map((r: Recipe) => r.id);
      addToRecipeHistory(newRecipeIds, 'ai-generated');
      console.log('✅ Swap suggestions added to history tracking');

      // Update suggested swaps
      setSuggestedSwaps(data.recipes);

      track('swap', {
        day: dayName,
        oldRecipeId: weekPlan[swapDayIndex]?.recipeId || 'unknown',
        newRecipeId: 'ai_suggestions_generated',
      });

    } catch (error) {
      console.error('❌ Error generating AI swaps:', error);
      setGenerationError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsGeneratingAISwaps(false);
    }
  };

  const handleSelectSwap = (recipe: Recipe) => {
    if (swapDayIndex === null) return;
    
    const isAddingNew = weekPlan[swapDayIndex] === null;
    
    track('swap', { 
      day: DAYS[swapDayIndex],
      oldRecipeId: weekPlan[swapDayIndex]?.recipeId || 'none',
      newRecipeId: recipe.id,
      action: isAddingNew ? 'add' : 'swap'
    });
    
    const household = loadHousehold() || getDefaultHousehold();
    
    // Generate reasons for the new meal
    const reasons: string[] = [];
    if (recipe.timeMins && recipe.timeMins <= 40) reasons.push("≤40m");
    if (recipe.tags.includes("kid_friendly")) reasons.push("kid-friendly");
    if (recipe.tags.includes("bulk_cook")) reasons.push("bulk cook");
    if (household.favorites.includes(recipe.id)) reasons.push("favorite");
    if (recipe.costPerServeEst && recipe.costPerServeEst < 4) reasons.push("best value");
    
    // Get chef/source display name
    const chefName = getRecipeSourceDisplay(recipe);
    
    const newMeal: MealCardProps = {
      recipeId: recipe.id,
      title: recipe.title,
      chef: chefName,
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
    const oldCost = oldMeal ? (RecipeLibrary.getById(oldMeal.recipeId)?.costPerServeEst || 0) * 4 : 0;
    const newCost = (recipe.costPerServeEst || 0) * 4;
    const budgetDiff = newCost - oldCost;
    setBudget(prev => ({ ...prev, current: prev.current + budgetDiff }));
    
    // Save updated week plan
    const nextWeekISO = nextWeekMondayISO();
    const recipeIds = newWeekPlan.map(meal => meal?.recipeId || "");
    saveCurrentWeekPlan(recipeIds, nextWeekISO, pantryItems);
    console.log('✅ Week plan updated after swap');
    
    // Close drawer
    setSwapDayIndex(null);
  };

  const handleAddSavedRecipe = (dayIndex: number) => {
    console.log(`➕ Adding saved recipe for ${DAYS[dayIndex]}`);
    
    // Open swap drawer for adding a new recipe
    setSwapDayIndex(dayIndex);
    setSuggestedSwaps([]); // Clear AI suggestions so it defaults to saved tab
    
    track('page_view', { page: 'add_saved_recipe', day: DAYS[dayIndex] });
  };

  const handleDeleteMeal = (dayIndex: number) => {
    const meal = weekPlan[dayIndex];
    if (!meal) return;
    
    console.log(`🗑️ Deleting meal for ${DAYS[dayIndex]}`);
    
    // Remove the meal from the plan
    const newWeekPlan = [...weekPlan];
    newWeekPlan[dayIndex] = null;
    setWeekPlan(newWeekPlan);
    
    // Update budget
    const recipe = RecipeLibrary.getById(meal.recipeId);
    const costToRemove = recipe ? (recipe.costPerServeEst || 0) * (recipe.serves || 4) : 0;
    setBudget(prev => ({ ...prev, current: prev.current - costToRemove }));
    
    // Save updated week plan
    const nextWeekISO = nextWeekMondayISO();
    const recipeIds = newWeekPlan.map(m => m?.recipeId || "");
    saveCurrentWeekPlan(recipeIds, nextWeekISO, pantryItems);
    console.log('✅ Week plan updated after deletion');
    
    track('swap', {
      day: DAYS[dayIndex],
      oldRecipeId: meal.recipeId,
      newRecipeId: 'deleted',
    });
  };

  const handleWizardComplete = async (wizardData: WeeklyPlanData) => {
    console.log('🧙 Wizard completed with data:', wizardData);
    
    // Set pantry items from wizard
    setPantryItems(wizardData.pantryItems);
    
    // Hide wizard and show plan view with loading states
    setShowWizard(false);
    
    // Clear previous week plan to show loading skeletons
    setWeekPlan([null, null, null, null, null, null, null]);
    
    // Generate plan using wizard data
    setIsGenerating(true);
    setGenerationError(null);

    try {
      console.log('🤖 [1/6] Starting AI meal plan generation from wizard...');
      
      const familySettings = getFamilySettings();
      
      // Override cuisines with wizard selection for this week only
      const weeklySettings = {
        ...familySettings,
        cuisines: wizardData.cuisines.length > 0 ? wizardData.cuisines : familySettings.cuisines,
        preferredChef: wizardData.preferredChef || familySettings.preferredChef
      };
      
      console.log('✅ [2/6] Family settings loaded:', {
        servings: weeklySettings.totalServings,
        cuisines: weeklySettings.cuisines,
        preferredChef: weeklySettings.preferredChef,
        budgetRange: `$${weeklySettings.budgetPerMeal.min}-${weeklySettings.budgetPerMeal.max}`,
        pantryPreference: weeklySettings.pantryPreference,
        pantryItemsCount: wizardData.pantryItems.length,
      });
      
      // Get recipe IDs to exclude from history
      const excludeRecipeIds = getRecipeIdsToExclude();
      console.log('📜 [3/6] Recipe history loaded:', excludeRecipeIds.length, 'recipes to avoid');
      
      console.log('📡 [4/6] Calling API...');
      const response = await fetch('/api/generate-recipes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          familySettings: weeklySettings,
          numberOfRecipes: 5,
          excludeRecipeIds,
          pantryItems: wizardData.pantryItems,
        }),
      });

      console.log('📥 [5/6] API response status:', response.status, response.statusText);
      
      const data = await response.json();
      console.log('📦 [5/6] API response data:', data);

      if (!response.ok || data.error) {
        console.error('❌ API error:', data);
        throw new Error(data.error || data.details || `HTTP ${response.status}: ${response.statusText}`);
      }

      if (!data.recipes || !Array.isArray(data.recipes)) {
        console.error('❌ Invalid response format:', data);
        throw new Error('Invalid response format: missing recipes array');
      }

      console.log('✅ [6/6] Generated recipes:', data.recipes.length, 'recipes');

      // Save AI recipes to library
      const saved = RecipeLibrary.addCustomRecipes(data.recipes);
      if (saved) {
        console.log('✅ Recipes saved to library');
      }
      
      // Add to recipe history
      const newRecipeIds = data.recipes.map((r: Recipe) => r.id);
      addToRecipeHistory(newRecipeIds, 'ai-generated');

      // Convert to meal plan
      const aiMeals: (MealCardProps | null)[] = data.recipes.map((recipe: Recipe) => ({
        recipeId: recipe.id,
        title: recipe.title,
        chef: "AI Generated",
        timeMins: recipe.timeMins || 30,
        kidsFriendly: recipe.tags?.includes("kid_friendly") ?? true,
        conflicts: [],
        reasons: ["AI suggested", "✨ personalized"]
      }));

      setWeekPlan(aiMeals);
      
      // Save week plan
      const nextWeekISO = nextWeekMondayISO();
      const recipeIds = data.recipes.map((r: Recipe) => r.id);
      saveCurrentWeekPlan(recipeIds, nextWeekISO, wizardData.pantryItems);
      
      // Update budget
      const totalCost = data.recipes.reduce((sum: number, r: Recipe) => {
        return sum + ((r.costPerServeEst || 0) * (r.serves || 4));
      }, 0);
      setBudget({ current: totalCost, total: 120 });

      console.log('🎉 Wizard-based generation complete!');

      track('plan_composed', {
        dayCount: 7,
        pantryItemCount: wizardData.pantryItems.length,
        cuisineCount: wizardData.cuisines.length,
        cost: totalCost,
        conflicts: 0,
        leftoverDays: 0,
        proteinVariety: 0,
      });

    } catch (error) {
      console.error('❌ Error generating plan from wizard:', error);
      setGenerationError(error instanceof Error ? error.message : 'Unknown error');
      setShowWizard(true); // Show wizard again on error
    } finally {
      setIsGenerating(false);
    }
  };


  const handleScanPantryImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanError(null);

    try {
      console.log('📸 Scanning pantry image:', file.name);

      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/scan-pantry-image', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        // Handle rate limit error specifically
        if (data.isRateLimit) {
          throw new Error('API rate limit reached. Please wait a few minutes and try again, or add ingredients manually.');
        }
        throw new Error(data.error || data.details || 'Failed to scan image');
      }

      console.log('✅ Ingredients detected:', data.ingredients);

      // Add detected ingredients to pantry items (avoiding duplicates)
      const newIngredients = data.ingredients.filter(
        (item: string) => !pantryItems.some(existing => existing.toLowerCase() === item.toLowerCase())
      );

      if (newIngredients.length > 0) {
        setPantryItems([...pantryItems, ...newIngredients]);
      }

      // Reset file input
      event.target.value = '';

    } catch (error) {
      console.error('❌ Error scanning image:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to scan image';
      setScanError(errorMessage);
    } finally {
      setIsScanning(false);
    }
  };

  const handleGenerateWithAI = async () => {
    // Clear previous plan to show loading skeletons
    setWeekPlan([null, null, null, null, null, null, null]);
    
    setIsGenerating(true);
    setGenerationError(null);

    try {
      console.log('🤖 [1/6] Starting AI meal plan generation...');
      
      const familySettings = getFamilySettings();
      console.log('✅ [2/6] Family settings loaded:', {
        servings: familySettings.totalServings,
        cuisines: familySettings.cuisines,
        budgetRange: `$${familySettings.budgetPerMeal.min}-${familySettings.budgetPerMeal.max}`,
        pantryPreference: familySettings.pantryPreference,
        pantryItemsCount: pantryItems.length,
      });
      
      // Get recipe IDs to exclude from history
      const excludeRecipeIds = getRecipeIdsToExclude();
      console.log('� [3/6] Recipe history loaded:', excludeRecipeIds.length, 'recipes to avoid');
      
      console.log('📡 [4/6] Calling API...');
      const response = await fetch('/api/generate-recipes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          familySettings,
          numberOfRecipes: 5, // Start with 5 to avoid timeout/truncation
          excludeRecipeIds, // Pass recipe history to avoid repetition
          pantryItems, // Pass pantry items for AI to prioritize
        }),
      });

      console.log('📥 [5/6] API response status:', response.status, response.statusText);
      
      const data = await response.json();
      console.log('📦 [5/6] API response data:', data);

      if (!response.ok || data.error) {
        console.error('❌ API error:', data);
        throw new Error(data.error || data.details || `HTTP ${response.status}: ${response.statusText}`);
      }

      if (!data.recipes || !Array.isArray(data.recipes)) {
        console.error('❌ Invalid response format:', data);
        throw new Error('Invalid response format: missing recipes array');
      }

      console.log('✅ [6/6] Generated recipes:', data.recipes.length, 'recipes');
      console.log('Recipe titles:', data.recipes.map((r: Recipe) => r.title));

      // Save AI recipes to library for persistence
      console.log('💾 Saving AI recipes to library...');
      const saved = RecipeLibrary.addCustomRecipes(data.recipes);
      if (saved) {
        console.log('✅ Recipes saved to library and will persist across sessions');
      } else {
        console.warn('⚠️ Failed to save recipes to library (localStorage issue?)');
      }
      
      // Add to recipe history to avoid repetition
      const newRecipeIds = data.recipes.map((r: Recipe) => r.id);
      const historyAdded = addToRecipeHistory(newRecipeIds, 'ai-generated');
      if (historyAdded) {
        console.log('✅ Recipes added to history tracking');
      }

      // Convert AI recipes to meal plan
      const aiMeals: (MealCardProps | null)[] = data.recipes.map((recipe: Recipe) => ({
        recipeId: recipe.id,
        title: recipe.title,
        chef: "AI Generated",
        timeMins: recipe.timeMins || 30,
        kidsFriendly: recipe.tags?.includes("kid_friendly") ?? true,
        conflicts: [],
        reasons: ["AI suggested", "✨ personalized"]
      }));

      setWeekPlan(aiMeals);
      
      // Save week plan to storage for shopping list
      const nextWeekISO = nextWeekMondayISO();
      const recipeIds = data.recipes.map((r: Recipe) => r.id);
      const planSaved = saveCurrentWeekPlan(recipeIds, nextWeekISO, pantryItems);
      if (planSaved) {
        console.log('✅ Week plan saved for shopping list');
      } else {
        console.warn('⚠️ Failed to save week plan');
      }
      
      // Update budget estimate
      const totalCost = data.recipes.reduce((sum: number, r: Recipe) => {
        return sum + ((r.costPerServeEst || 0) * (r.serves || 4));
      }, 0);
      setBudget({ current: totalCost, total: 120 });

      console.log('🎉 AI generation complete! Total cost:', totalCost);

      track('plan_composed', {
        dayCount: 7,
        cost: totalCost,
        conflicts: 0,
        leftoverDays: 0,
        proteinVariety: 0,
      });

    } catch (error) {
      console.error('❌ Error generating AI plan:', error);
      setGenerationError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateSingleRecipe = async (dayIndex: number) => {
    setGeneratingDayIndex(dayIndex);
    setGenerationError(null);

    try {
      const dayName = DAYS[dayIndex];
      console.log(`🤖 Generating single recipe for ${dayName}...`);
      
      const familySettings = getFamilySettings();
      
      // Determine if it's a weekend or weeknight
      const dayType = dayIndex >= 5 ? 'weekend' : 'weeknight';
      
      // Get existing recipe IDs to avoid duplicates
      const existingRecipeIds = weekPlan
        .filter(meal => meal !== null)
        .map(meal => meal!.recipeId);
      
      // Combine with recipe history to avoid repetition
      const historyIds = getRecipeIdsToExclude();
      const excludeRecipeIds = [...new Set([...existingRecipeIds, ...historyIds])];
      console.log('📚 Excluding', excludeRecipeIds.length, 'recipes from generation');
      
      console.log('📡 Calling API for single recipe...');
      const response = await fetch('/api/generate-recipes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          familySettings,
          numberOfRecipes: 1,
          excludeRecipeIds,
          specificDays: [{ index: dayIndex, type: dayType }],
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        console.error('❌ API error:', data);
        throw new Error(data.error || data.details || `HTTP ${response.status}`);
      }

      if (!data.recipes || data.recipes.length === 0) {
        throw new Error('No recipe generated');
      }

      const recipe: Recipe = data.recipes[0];
      console.log('✅ Generated recipe:', recipe.title);

      // Save to library
      RecipeLibrary.addCustomRecipes([recipe]);
      console.log('✅ Recipe saved to library');
      
      // Add to recipe history
      addToRecipeHistory([recipe.id], 'ai-generated');
      console.log('✅ Recipe added to history tracking');

      // Create meal card
      const household = loadHousehold() || getDefaultHousehold();
      const reasons: string[] = [];
      if (recipe.timeMins && recipe.timeMins <= 40) reasons.push("≤40m");
      if (recipe.tags?.includes("kid_friendly")) reasons.push("kid-friendly");
      if (household.favorites.includes(recipe.id)) reasons.push("favorite");
      
      const newMeal: MealCardProps = {
        recipeId: recipe.id,
        title: recipe.title,
        chef: "AI Generated",
        timeMins: recipe.timeMins || 30,
        kidsFriendly: recipe.tags?.includes("kid_friendly") ?? true,
        conflicts: [],
        reasons: ["AI suggested", "✨ personalized", ...reasons]
      };

      // Update the week plan
      const newWeekPlan = [...weekPlan];
      newWeekPlan[dayIndex] = newMeal;
      setWeekPlan(newWeekPlan);

      // Update budget
      const newCost = (recipe.costPerServeEst || 0) * (recipe.serves || 4);
      setBudget(prev => ({ ...prev, current: prev.current + newCost }));

      // Save updated week plan
      const nextWeekISO = nextWeekMondayISO();
      const recipeIds = newWeekPlan.map(meal => meal?.recipeId || "");
      saveCurrentWeekPlan(recipeIds, nextWeekISO, pantryItems);
      console.log('✅ Week plan updated');

      track('swap', {
        day: dayName,
        oldRecipeId: 'empty',
        newRecipeId: recipe.id,
      });

    } catch (error) {
      console.error('❌ Error generating recipe:', error);
      setGenerationError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setGeneratingDayIndex(null);
    }
  };

  return (
    <main style={{ padding: 24 }}>
      {showWizard ? (
        <WeeklyPlanWizard
          onComplete={handleWizardComplete}
          onCancel={() => {
            // If user cancels, generate a basic plan instead
            setShowWizard(false);
            handleGenerateWithAI();
          }}
        />
      ) : (
        <Stack direction="column" gap="xl">
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h1">Weekly Meal Plan</Typography>
            <Stack direction="row" gap="md">
              <Button
                variant="secondary"
                size="large"
                onClick={() => setShowWizard(true)}
              >
                Start new week
              </Button>
              <Badge count={pantryItems.length}>
                <Button
                  variant="secondary"
                  size="large"
                  onClick={() => setShowPantrySheet(true)}
                >
                  View pantry items
                </Button>
              </Badge>
            </Stack>
          </Stack>

        {/* Error Message */}
        {generationError && (
          <Alert variant="error">
            {generationError}
          </Alert>
        )}

        {/* Saturday Banner for Weekly Overrides */}
        {showSaturdayBanner && (
          <Alert 
            variant="warning" 
            title="Plan for next week"
            action={
              <Button
                variant="primary"
                size="small"
                onClick={() => setShowOverridesSheet(true)}
              >
                Update next week inputs
              </Button>
            }
          >
            Update your preferences for next week&apos;s meal plan
          </Alert>
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
          onGenerateClick={handleGenerateSingleRecipe}
          onAddSavedRecipeClick={handleAddSavedRecipe}
          generatingDayIndex={generatingDayIndex}
          onDeleteClick={handleDeleteMeal}
          isGeneratingPlan={isGenerating}
        />
        
        {/* Actions */}
        <Stack direction="row" gap="md" justifyContent="flex-end">
          <Button
            variant="secondary"
            size="large"
            onClick={handleGenerateWithAI}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating...' : 'Generate new plan'}
          </Button>
          <Button
            variant="primary"
            size="large"
            purpose="link"
            url="/plan/review"
          >
            Review plan
          </Button>
        </Stack>
        </Stack>
      )}

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
            ? RecipeLibrary.getById(weekPlan[swapDayIndex]!.recipeId) ?? null
            : null
        }
        suggestedSwaps={suggestedSwaps}
        onSelectSwap={handleSelectSwap}
        onGenerateAISuggestions={handleGenerateAISwaps}
        isGeneratingAI={isGeneratingAISwaps}
      />

      <PantrySheet
        isOpen={showPantrySheet}
        onClose={() => setShowPantrySheet(false)}
        pantryItems={pantryItems}
        onUpdatePantryItems={handleUpdatePantryItems}
        onScanImage={handleScanPantryImage}
        isScanning={isScanning}
        scanError={scanError}
      />
    </main>
  );
}