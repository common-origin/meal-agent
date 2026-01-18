"use client";

import { useEffect, useState } from "react";
import { Alert, Badge, Stack, Typography, Button } from "@common-origin/design-system";
import Main from "@/components/app/Main";
import ButtonGroup from "@/components/app/ButtonGroup";
import WeekPlannerGrid from "@/components/app/WeekPlannerGrid";
import BudgetSummary from "@/components/app/BudgetSummary";
import WeeklyOverridesSheet from "@/components/app/WeeklyOverridesSheet";
import SwapDrawer from "@/components/app/SwapDrawer";
import WeeklyPlanWizard, { type WeeklyPlanData } from "@/components/app/WeeklyPlanWizard";
import PantrySheet from "@/components/app/PantrySheet";
import { type MealCardProps } from "@/components/app/MealCard";
import { type Recipe } from "@/lib/types/recipe";
import { scheduleSundayToast, isSaturdayAfter4, nextWeekMondayISO } from "@/lib/schedule";
import { loadHousehold, getDefaultHousehold } from "@/lib/storage";
import { getFamilySettings, saveCurrentWeekPlan, loadCurrentWeekPlan } from "@/lib/storageAsync";
import { getSuggestedSwaps } from "@/lib/compose";
import { RecipeLibrary } from "@/lib/library";
import { track } from "@/lib/analytics";
import { addToRecipeHistory, getRecipeIdsToExclude } from "@/lib/recipeHistory";
import { getRecipeSourceDisplay } from "@/lib/recipeDisplay";
import { trackIngredientUsage } from "@/lib/ingredientAnalytics";

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
  const [ariaLiveMessage, setAriaLiveMessage] = useState<string>("");
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);

  
  // Pantry items state
  const [pantryItems, setPantryItems] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    track('page_view', { page: '/plan' });
    scheduleSundayToast();
    
    (async () => {
      setIsLoadingInitial(true);
      // First, load all recipes from Supabase to populate RecipeLibrary cache
      console.log('📚 Loading recipes from Supabase...');
      const { loadAllRecipes } = await import('@/lib/hybridStorage');
      const supabaseRecipes = await loadAllRecipes();
      console.log(`📚 Loaded ${supabaseRecipes.length} recipes from Supabase`);
      console.log('📚 Recipe IDs from Supabase:', supabaseRecipes.map(r => r.id).slice(0, 10));
      
      // Sync to localStorage so RecipeLibrary.getById() can find them
      if (supabaseRecipes.length > 0) {
        RecipeLibrary.syncSupabaseRecipes(supabaseRecipes);
        console.log(`✅ Synced ${supabaseRecipes.length} recipes to localStorage cache`);
      }
      
      const household = loadHousehold() || getDefaultHousehold();
      const familySettings = await getFamilySettings();
      const nextWeekISO = nextWeekMondayISO();
      
      // Check if there's a saved week plan first
      const savedPlan = await loadCurrentWeekPlan(nextWeekISO);
    
    if (savedPlan && savedPlan.recipeIds.length > 0) {
      // Use the saved plan
      console.log('📋 Plan page: Loading saved week plan with recipe IDs:', savedPlan.recipeIds);
      setShowWizard(false);
      
      // Build a recipe lookup map from Supabase recipes for immediate access
      const recipeMap = new Map(supabaseRecipes.map(r => [r.id, r]));
      
      const meals: (MealCardProps | null)[] = savedPlan.recipeIds.map(recipeId => {
        if (!recipeId) return null;
        
        // Try Supabase recipes first, then fall back to RecipeLibrary
        const recipe = recipeMap.get(recipeId) || RecipeLibrary.getById(recipeId);
        if (!recipe) {
          console.warn(`❌ Recipe ${recipeId} not found in Supabase or localStorage`);
          console.warn(`⚠️ This meal plan may be from before the persistence fix. Generate a new plan to fix.`);
          return null;
        }
        console.log(`✅ Found recipe: ${recipe.title} (${recipeId})`);

        
        // Generate reasons for this meal
        const reasons: string[] = [];
        if (recipe.timeMins && recipe.timeMins < 25) reasons.push("quick");
        if (recipe.tags.includes("kid_friendly")) reasons.push("kid-friendly");
        if (recipe.tags.includes("bulk_cook")) reasons.push("bulk cook");
        if (household.favorites.includes(recipe.id)) reasons.push("favorite");
        if (recipe.costPerServeEst && recipe.costPerServeEst < 4) reasons.push("best value");
        
        // Get chef/source display name (hide "AI Generated" on Plan page)
        const chefDisplay = getRecipeSourceDisplay(recipe);
        const displayChef = chefDisplay === "AI Generated" ? "" : chefDisplay;
        
        return {
          recipeId: recipe.id,
          title: recipe.title,
          chef: displayChef,
          timeMins: recipe.timeMins || 0,
          conflicts: [],
          reasons,
          nutrition: recipe.nutrition,
        };
      });
      
      // Calculate budget from saved recipes
      const totalCost = savedPlan.recipeIds.reduce((sum, recipeId) => {
        if (!recipeId) return sum;
        const recipe = RecipeLibrary.getById(recipeId);
        return sum + ((recipe?.costPerServeEst || 0) * (recipe?.serves || 4));
      }, 0);
      
      // Calculate weekly budget based on number of meals and budget per meal setting
      const numberOfMeals = savedPlan.recipeIds.filter(id => id).length;
      const weeklyBudget = numberOfMeals * familySettings.budgetPerMeal.max;
      
      setWeekPlan(meals);
      setBudget({ current: totalCost, total: weeklyBudget });
      console.log('✅ Loaded saved week plan with', meals.filter(m => m !== null).length, 'meals');
      
      // Track ingredient usage from saved plan
      const validRecipeIds = savedPlan.recipeIds.filter((id): id is string => id !== null);
      if (validRecipeIds.length > 0) {
        trackIngredientUsage(validRecipeIds);
      }
      
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
      
      // Loading complete
      setIsLoadingInitial(false);
    })();
  }, []);

  // Handler for updating pantry items
  const handleUpdatePantryItems = async (items: string[]) => {
    setPantryItems(items);
    
    // Save updated pantry items to storage
    const nextWeekISO = nextWeekMondayISO();
    const recipeIds = weekPlan.map(m => m?.recipeId || "");
    await saveCurrentWeekPlan(recipeIds, nextWeekISO, items);
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
      
      const familySettings = await getFamilySettings();
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

      // Save to Supabase and localStorage
      await RecipeLibrary.addTempAIRecipes(data.recipes);
      console.log('✅ AI swaps saved to Supabase and localStorage');
      
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

  const handleSelectSwap = async (recipe: Recipe) => {
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
    if (recipe.timeMins && recipe.timeMins < 25) reasons.push("quick");
    if (recipe.tags.includes("kid_friendly")) reasons.push("kid-friendly");
    if (recipe.tags.includes("bulk_cook")) reasons.push("bulk cook");
    if (household.favorites.includes(recipe.id)) reasons.push("favorite");
    if (recipe.costPerServeEst && recipe.costPerServeEst < 4) reasons.push("best value");
    
    // Get chef/source display name (hide "AI Generated" on Plan page)
    const chefName = getRecipeSourceDisplay(recipe);
    const displayChef = chefName === "AI Generated" ? "" : chefName;
    
    const newMeal: MealCardProps = {
      recipeId: recipe.id,
      title: recipe.title,
      chef: displayChef,
      timeMins: recipe.timeMins || 0,
      conflicts: [],
      reasons,
      nutrition: recipe.nutrition,
    };
    
    // Update the meal plan
    const newWeekPlan = [...weekPlan];
    const oldMeal = newWeekPlan[swapDayIndex];
    newWeekPlan[swapDayIndex] = newMeal;
    setWeekPlan(newWeekPlan);
    
    // Update budget (recalculate total based on number of meals)
    const familySettings = await getFamilySettings();
    const numberOfMeals = newWeekPlan.filter(m => m !== null).length;
    const oldRecipe = oldMeal ? RecipeLibrary.getById(oldMeal.recipeId) : null;
    const oldCost = oldRecipe ? (oldRecipe.costPerServeEst || 0) * (oldRecipe.serves || 4) : 0;
    const newCost = (recipe.costPerServeEst || 0) * (recipe.serves || 4);
    const budgetDiff = newCost - oldCost;
    const weeklyBudget = numberOfMeals * familySettings.budgetPerMeal.max;
    setBudget(prev => ({ current: prev.current + budgetDiff, total: weeklyBudget }));
    
    // Save updated week plan
    const nextWeekISO = nextWeekMondayISO();
    const recipeIds = newWeekPlan.map(meal => meal?.recipeId || "");
    await saveCurrentWeekPlan(recipeIds, nextWeekISO, pantryItems);
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

  const handleDeleteMeal = async (dayIndex: number) => {
    const meal = weekPlan[dayIndex];
    if (!meal) return;
    
    console.log(`🗑️ Deleting meal for ${DAYS[dayIndex]}`);
    
    // Remove the meal from the plan
    const newWeekPlan = [...weekPlan];
    newWeekPlan[dayIndex] = null;
    setWeekPlan(newWeekPlan);
    
    // Update budget (recalculate total based on number of meals)
    const familySettings = await getFamilySettings();
    const numberOfMeals = newWeekPlan.filter(m => m !== null).length;
    const recipe = RecipeLibrary.getById(meal.recipeId);
    const costToRemove = recipe ? (recipe.costPerServeEst || 0) * (recipe.serves || 4) : 0;
    const weeklyBudget = numberOfMeals * familySettings.budgetPerMeal.max;
    setBudget(prev => ({ current: prev.current - costToRemove, total: weeklyBudget }));
    
    // Save updated week plan
    const nextWeekISO = nextWeekMondayISO();
    const recipeIds = newWeekPlan.map(m => m?.recipeId || "");
    await saveCurrentWeekPlan(recipeIds, nextWeekISO, pantryItems);
    console.log('✅ Week plan updated after deletion');
    
    track('swap', {
      day: DAYS[dayIndex],
      oldRecipeId: meal.recipeId,
      newRecipeId: 'deleted',
    });
  };

  const handleReorder = async (oldIndex: number, newIndex: number) => {
    console.log(`🔄 Reordering: ${DAYS[oldIndex]} → ${DAYS[newIndex]}`);
    
    // Create new array with swapped meals
    const newWeekPlan = [...weekPlan];
    const [movedMeal] = newWeekPlan.splice(oldIndex, 1);
    newWeekPlan.splice(newIndex, 0, movedMeal);
    
    setWeekPlan(newWeekPlan);
    
    // Save updated week plan
    const nextWeekISO = nextWeekMondayISO();
    const recipeIds = newWeekPlan.map(m => m?.recipeId || "");
    await saveCurrentWeekPlan(recipeIds, nextWeekISO, pantryItems);
    console.log('✅ Week plan reordered and saved');
    
    // Track analytics
    track('meal_reordered', {
      fromDay: DAYS[oldIndex],
      toDay: DAYS[newIndex],
      recipeId: movedMeal?.recipeId || 'none',
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
    setAriaLiveMessage("Generating weekly meal plan...");

    try {
      console.log('🤖 [1/6] Starting AI meal plan generation from wizard...');
      
      const familySettings = await getFamilySettings();
      
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
      console.log('📋 Recipe IDs:', data.recipes.map((r: Recipe) => r.id));

      // Save AI recipes to Supabase (and localStorage for backward compatibility)
      console.log('💾 Saving recipes to Supabase...');
      const saved = await RecipeLibrary.addTempAIRecipes(data.recipes);
      if (saved) {
        console.log('✅ All recipes saved successfully');
      } else {
        console.error('❌ Failed to save some recipes');
      }
      
      // Add to recipe history
      const newRecipeIds = data.recipes.map((r: Recipe) => r.id);
      addToRecipeHistory(newRecipeIds, 'ai-generated');

      // Convert to meal plan
      const aiMeals: (MealCardProps | null)[] = data.recipes.map((recipe: Recipe) => ({
        recipeId: recipe.id,
        title: recipe.title,
        chef: "",
        timeMins: recipe.timeMins || 30,
        conflicts: [],
        reasons: ["AI suggested", "✨ personalized"],
        nutrition: recipe.nutrition,
      }));

      setWeekPlan(aiMeals);
      
      // Save week plan
      const nextWeekISO = nextWeekMondayISO();
      const recipeIds = data.recipes.map((r: Recipe) => r.id);
      await saveCurrentWeekPlan(recipeIds, nextWeekISO, wizardData.pantryItems);
      
      // Track ingredient usage for analytics
      trackIngredientUsage(recipeIds);
      
      // Update budget based on family settings
      const totalCost = data.recipes.reduce((sum: number, r: Recipe) => {
        return sum + ((r.costPerServeEst || 0) * (r.serves || 4));
      }, 0);
      const weeklyBudget = data.recipes.length * weeklySettings.budgetPerMeal.max;
      setBudget({ current: totalCost, total: weeklyBudget });

      console.log('🎉 Wizard-based generation complete!');
      setAriaLiveMessage("Weekly meal plan generated successfully!");

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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setGenerationError(errorMessage);
      setAriaLiveMessage(`Error generating plan: ${errorMessage}`);
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
    setAriaLiveMessage("Generating weekly meal plan...");

    try {
      console.log('🤖 [1/6] Starting AI meal plan generation...');
      
      const familySettings = await getFamilySettings();
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

      // Save AI recipes to Supabase and localStorage
      console.log('💾 Saving AI recipes to Supabase...');
      const saved = await RecipeLibrary.addTempAIRecipes(data.recipes);
      if (saved) {
        console.log('✅ Recipes saved to Supabase and will persist across sessions');
      } else {
        console.warn('⚠️ Failed to save recipes');
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
        chef: "",
        timeMins: recipe.timeMins || 30,
        conflicts: [],
        reasons: ["AI suggested", "✨ personalized"],
        nutrition: recipe.nutrition,
      }));

      setWeekPlan(aiMeals);
      
      // Save week plan to storage for shopping list
      const nextWeekISO = nextWeekMondayISO();
      const recipeIds = data.recipes.map((r: Recipe) => r.id);
      const planSaved = await saveCurrentWeekPlan(recipeIds, nextWeekISO, pantryItems);
      if (planSaved) {
        console.log('✅ Week plan saved for shopping list');
        // Track ingredient usage for analytics
        trackIngredientUsage(recipeIds);
      } else {
        console.warn('⚠️ Failed to save week plan');
      }
      
      // Update budget estimate based on family settings
      const totalCost = data.recipes.reduce((sum: number, r: Recipe) => {
        return sum + ((r.costPerServeEst || 0) * (r.serves || 4));
      }, 0);
      const weeklyBudget = data.recipes.length * familySettings.budgetPerMeal.max;
      setBudget({ current: totalCost, total: weeklyBudget });

      console.log('🎉 AI generation complete! Total cost:', totalCost);
      setAriaLiveMessage("Weekly meal plan generated successfully!");

      track('plan_composed', {
        dayCount: 7,
        cost: totalCost,
        conflicts: 0,
        leftoverDays: 0,
        proteinVariety: 0,
      });

    } catch (error) {
      console.error('❌ Error generating AI plan:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setGenerationError(errorMessage);
      setAriaLiveMessage(`Error generating plan: ${errorMessage}`);
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
      setAriaLiveMessage(`Generating AI recipe for ${dayName}...`);
      
      const familySettings = await getFamilySettings();
      
      // Determine if it's a weekend or weeknight
      const dayType = dayIndex >= 5 ? 'weekend' : 'weeknight';
      
      // Get existing recipe IDs to avoid duplicates
      const existingRecipeIds = weekPlan
        .filter(meal => meal !== null)
        .map(meal => meal!.recipeId);
      
      // Analyze existing proteins in the week plan for variety
      const existingProteins: string[] = [];
      weekPlan.forEach(meal => {
        if (meal) {
          const recipe = RecipeLibrary.getById(meal.recipeId);
          if (recipe) {
            // Check tags for protein types
            const proteinTags = ['chicken', 'beef', 'pork', 'fish', 'lamb', 'seafood', 'tofu', 'lentil', 'bean'];
            const recipeProteins = recipe.tags.filter(tag => proteinTags.includes(tag));
            existingProteins.push(...recipeProteins);
          }
        }
      });
      
      // Combine with recipe history to avoid repetition
      const historyIds = getRecipeIdsToExclude();
      const excludeRecipeIds = [...new Set([...existingRecipeIds, ...historyIds])];
      console.log('📚 Excluding', excludeRecipeIds.length, 'recipes from generation');
      console.log('🥩 Existing proteins in week:', existingProteins.length > 0 ? existingProteins.join(', ') : 'none');
      
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
          existingProteins, // Pass existing proteins for variety
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

      // Save to Supabase and localStorage
      await RecipeLibrary.addTempAIRecipes([recipe]);
      console.log('✅ Recipe saved to Supabase and localStorage');
      
      // Add to recipe history
      addToRecipeHistory([recipe.id], 'ai-generated');
      console.log('✅ Recipe added to history tracking');

      // Create meal card
      const household = loadHousehold() || getDefaultHousehold();
      const reasons: string[] = [];
      if (recipe.timeMins && recipe.timeMins < 25) reasons.push("quick");
      if (recipe.tags?.includes("kid_friendly")) reasons.push("kid-friendly");
      if (household.favorites.includes(recipe.id)) reasons.push("favorite");
      
      const newMeal: MealCardProps = {
        recipeId: recipe.id,
        title: recipe.title,
        chef: "AI Generated",
        timeMins: recipe.timeMins || 30,
        conflicts: [],
        reasons: ["AI suggested", "✨ personalized", ...reasons],
        nutrition: recipe.nutrition,
      };

      // Update the week plan
      const newWeekPlan = [...weekPlan];
      newWeekPlan[dayIndex] = newMeal;
      setWeekPlan(newWeekPlan);

      // Update budget (recalculate total based on number of meals)
      const numberOfMeals = newWeekPlan.filter(m => m !== null).length;
      const newCost = (recipe.costPerServeEst || 0) * (recipe.serves || 4);
      const weeklyBudget = numberOfMeals * familySettings.budgetPerMeal.max;
      setBudget(prev => ({ current: prev.current + newCost, total: weeklyBudget }));

      // Save updated week plan
      const nextWeekISO = nextWeekMondayISO();
      const recipeIds = newWeekPlan.map(meal => meal?.recipeId || "");
      await saveCurrentWeekPlan(recipeIds, nextWeekISO, pantryItems);
      console.log('✅ Week plan updated');
      setAriaLiveMessage(`Recipe generated for ${dayName}: ${recipe.title}`);

      track('swap', {
        day: dayName,
        oldRecipeId: 'empty',
        newRecipeId: recipe.id,
      });

    } catch (error) {
      console.error('❌ Error generating recipe:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setGenerationError(errorMessage);
      setAriaLiveMessage(`Error generating recipe for ${DAYS[dayIndex]}: ${errorMessage}`);
    } finally {
      setGeneratingDayIndex(null);
    }
  };

  return (
    <Main maxWidth="1400px">
      {/* ARIA live region for screen reader announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "absolute",
          left: "-10000px",
          width: "1px",
          height: "1px",
          overflow: "hidden"
        }}
      >
        {ariaLiveMessage}
      </div>

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
            <Typography variant="h1">Weekly meal plan</Typography>
            <Stack direction="row" gap="md">
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
        
        <BudgetSummary 
          weekPlan={weekPlan}
          budget={budget}
          dayNames={DAYS}
        />
        
        <WeekPlannerGrid 
          meals={weekPlan} 
          onSwapClick={handleSwapClick}
          onGenerateClick={handleGenerateSingleRecipe}
          onAddSavedRecipeClick={handleAddSavedRecipe}
          generatingDayIndex={generatingDayIndex}
          onDeleteClick={handleDeleteMeal}
          isGeneratingPlan={isGenerating || isLoadingInitial}
          onReorder={handleReorder}
        />
        
        {/* Actions */}
        <ButtonGroup
          left={
            <Button
                variant="secondary"
                size="large"
                iconName="refresh"
                onClick={() => setShowWizard(true)}
              >
                Start new week
              </Button>
          }
          right={
            <>
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
                iconName="fileDocSearch"
                purpose="link"
                url="/plan/review"
              >
                Review plan
              </Button>
            </>
          }
        />
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
    </Main>
  );
}