"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Stack, Typography, Button } from "@common-origin/design-system";
import Main from "@/components/app/Main";
import ButtonGroup from "@/components/app/ButtonGroup";
import WeekPlanList from "@/components/app/WeekPlanList";
import PlanDetailsSheet from "@/components/app/PlanDetailsSheet";
import SwapDrawer from "@/components/app/SwapDrawer";
import WeeklyPlanWizard, { type WeeklyPlanData } from "@/components/app/WeeklyPlanWizard";
import PantrySheet from "@/components/app/PantrySheet";
import { type MealCardProps } from "@/components/app/MealCard";
import { type Recipe } from "@/lib/types/recipe";
import { scheduleSundayToast, nextWeekMondayISO } from "@/lib/schedule";
import { formatPlanSummary, summarisePlan } from "@/lib/planSummary";
import { loadHousehold, getDefaultHousehold, getRecipeRatings, getBlockedRecipes, getFavorites } from "@/lib/storage";
import { getFamilySettings, saveCurrentWeekPlan, loadCurrentWeekPlan, hydrateRecencyFromSupabase, recordWeekHistory } from "@/lib/hybridStorage";
import { getRecentRecipeIds } from "@/lib/recencyTracker";
import { buildTasteSignals, type TasteSignals } from "@/lib/tasteSignals";
import { itemsToUseSoon, mergeScan, type PantryState } from "@/lib/pantryItems";
import { buildDaySlot, buildWeekSlate, newSlateSeed, type DaySlot } from "@/lib/planSlate";
import { generateDay, type DayRequest } from "@/lib/client/generateDay";
import { confirmPlan } from "@/lib/client/confirmPlan";
import type { FamilySettings } from "@/lib/types/settings";
import { getSuggestedSwaps } from "@/lib/compose";
import { RecipeLibrary } from "@/lib/library";
import { track } from "@/lib/analytics";
import { getRecipeSourceDisplay } from "@/lib/recipeDisplay";
import { trackIngredientUsage } from "@/lib/ingredientAnalytics";
import { useGenerationActivity } from "@/components/generation/GenerationActivityProvider";
import { apiErrorMessage, redirectToLoginIfUnauthenticated } from "@/lib/api/client";
import { imageUploadFormData, PhotoTooLargeError } from "@/lib/client/resizeImage";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Chips computed from the recipe itself ("quick", "kid-friendly", ...). */
function mealReasons(recipe: Recipe, favorites: string[]): string[] {
  const reasons: string[] = [];
  if (recipe.timeMins && recipe.timeMins < 25) reasons.push("quick");
  if (recipe.tags?.includes("kid_friendly")) reasons.push("kid-friendly");
  if (recipe.tags?.includes("bulk_cook")) reasons.push("bulk cook");
  if (favorites.includes(recipe.id)) reasons.push("favorite");
  if (recipe.costPerServeEst && recipe.costPerServeEst < 4) reasons.push("best value");
  return reasons;
}

/** A meal card for an AI recipe: computed chips plus the AI's line on it (#94). */
function toAiMeal(recipe: Recipe, explanation?: string): MealCardProps {
  const favorites = (loadHousehold() || getDefaultHousehold()).favorites;
  return {
    recipeId: recipe.id,
    title: recipe.title,
    chef: "",
    timeMins: recipe.timeMins || 30,
    conflicts: [],
    reasons: mealReasons(recipe, favorites),
    explanation,
    nutrition: recipe.nutrition,
  };
}

const PROTEIN_TAGS = ['chicken', 'beef', 'pork', 'lamb', 'fish', 'seafood'];

/** A recipe's main protein from its tags, for days generated before this session (#95). */
function proteinOf(recipe: Recipe | undefined): string | null {
  return recipe?.tags.find((tag) => PROTEIN_TAGS.includes(tag)) ?? null;
}

/** Per day, the AI's "why this meal" line to save with the plan (#94); '' where there's none. */
function planReasons(plan: (MealCardProps | null)[]): string[] {
  return plan.map((meal) => meal?.explanation ?? "");
}

/**
 * Taste and history titles for a generate request (#88), built from this
 * week's plan plus the household's history, ratings, blocks and favourites.
 */
async function loadTasteSignals(plan: (MealCardProps | null)[]): Promise<TasteSignals> {
  // Pull other devices' history first so "recent" covers the whole household.
  await hydrateRecencyFromSupabase().catch((err) => console.warn('Could not load recipe history:', err));
  return buildTasteSignals({
    plan: plan.filter((meal): meal is MealCardProps => meal !== null).map((meal) => meal.recipeId),
    recentIds: getRecentRecipeIds(),
    ratings: getRecipeRatings(),
    favorites: getFavorites(),
    blockedIds: Array.from(getBlockedRecipes()),
    library: RecipeLibrary,
  });
}

export default function PlanPage() {
  const { beginGeneration, endGeneration, isSignOutInProgress } = useGenerationActivity();
  const [showWizard, setShowWizard] = useState(false);
  const [showPantrySheet, setShowPantrySheet] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const router = useRouter();
  const [weekPlan, setWeekPlan] = useState<(MealCardProps | null)[]>([]);
  // The plan's source of truth for async work: days resolve out of order, so
  // each update builds on the latest plan, not a render's stale copy (#95).
  const weekPlanRef = useRef<(MealCardProps | null)[]>([]);
  const commitPlan = (next: (MealCardProps | null)[]) => {
    weekPlanRef.current = next;
    setWeekPlan(next);
    return next;
  };
  // The slot each AI meal was generated for, by recipe ID, so it follows the
  // meal through reorders and swaps when new slots are built around it (#95).
  const slotByRecipeRef = useRef(new Map<string, DaySlot>());
  // A failed day's slot, by day, so "Retry this day" asks for the same thing.
  const failedSlotsRef = useRef<Record<number, DaySlot>>({});
  // The settings (e.g. the wizard's cuisines for this week) the current plan was generated with.
  const planSettingsRef = useRef<FamilySettings | null>(null);
  // Saves run one at a time, each writing the latest plan, so an earlier
  // save can't land after a later one and drop a day (#95).
  const saveChainRef = useRef<Promise<unknown>>(Promise.resolve());
  const persistPlan = (pantry: string[]): Promise<boolean> => {
    const run = saveChainRef.current.then(() => {
      const plan = weekPlanRef.current;
      return saveCurrentWeekPlan(plan.map((meal) => meal?.recipeId || ""), nextWeekMondayISO(), pantry, planReasons(plan));
    });
    saveChainRef.current = run.catch(() => undefined);
    return run;
  };
  const [generatingDays, setGeneratingDays] = useState<number[]>([]);
  // Per-day failures, shown on that day with a Retry button (#96 copy).
  const [dayErrors, setDayErrors] = useState<Record<number, string>>({});
  // The household's max per meal; the weekly budget is this × the plan's dinners.
  const [budgetPerMeal, setBudgetPerMeal] = useState(20);
  const [swapDayIndex, setSwapDayIndex] = useState<number | null>(null);
  const [suggestedSwaps, setSuggestedSwaps] = useState<Recipe[]>([]);
  // Recipe ID → the AI's "why this meal" line for AI swap suggestions (#94).
  const [swapExplanations, setSwapExplanations] = useState<Record<string, string>>({});
  const [isGeneratingAISwaps, setIsGeneratingAISwaps] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [ariaLiveMessage, setAriaLiveMessage] = useState<string>("");
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);

  
  // Pantry items state
  const [pantryItems, setPantryItems] = useState<string[]>([]);
  // Per-week only: the saved pantry list stays string[] (#91).
  const [useSoon, setUseSoon] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    track('page_view', { page: '/plan' });
    scheduleSundayToast();
    
    (async () => {
      setIsLoadingInitial(true);
      
      // Load data in parallel for faster initial render
      const { loadAllRecipes } = await import('@/lib/hybridStorage');
      const nextWeekISO = nextWeekMondayISO();
      
      const [supabaseRecipes, familySettings, savedPlan] = await Promise.all([
        loadAllRecipes(),
        getFamilySettings(),
        loadCurrentWeekPlan(nextWeekISO),
      ]);
      
      console.log(`📚 Loaded ${supabaseRecipes.length} recipes from Supabase`);
      
      // Sync to localStorage so RecipeLibrary.getById() can find them
      if (supabaseRecipes.length > 0) {
        RecipeLibrary.syncSupabaseRecipes(supabaseRecipes);
        console.log(`✅ Synced ${supabaseRecipes.length} recipes to localStorage cache`);
      }
      
      const household = loadHousehold() || getDefaultHousehold();
      setBudgetPerMeal(familySettings.budgetPerMeal.max);
    
    if (savedPlan && savedPlan.recipeIds.length > 0) {
      // Use the saved plan
      console.log('📋 Plan page: Loading saved week plan with recipe IDs:', savedPlan.recipeIds);
      setShowWizard(false);
      
      // Build a recipe lookup map from Supabase recipes for immediate access
      const recipeMap = new Map(supabaseRecipes.map(r => [r.id, r]));
      
      const meals: (MealCardProps | null)[] = savedPlan.recipeIds.map((recipeId, index) => {
        if (!recipeId) return null;
        
        // Try Supabase recipes first, then fall back to RecipeLibrary
        const recipe = recipeMap.get(recipeId) || RecipeLibrary.getById(recipeId);
        if (!recipe) {
          console.warn(`❌ Recipe ${recipeId} not found in Supabase or localStorage`);
          console.warn(`⚠️ This meal plan may be from before the persistence fix. Generate a new plan to fix.`);
          return null;
        }
        console.log(`✅ Found recipe: ${recipe.title} (${recipeId})`);

        
        const reasons = mealReasons(recipe, household.favorites);
        
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
          explanation: savedPlan.reasons?.[index] || undefined,
          nutrition: recipe.nutrition,
        };
      });
      
      commitPlan(meals);
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
  const handleUpdatePantry = async ({ items, useSoon: soon }: PantryState) => {
    setPantryItems(items);
    setUseSoon(soon);
    
    // Save updated pantry items to storage
    await persistPlan(items);
    console.log('✅ Pantry items updated and saved');
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
    if (isSignOutInProgress) {
      console.warn('Sign-out in progress, refusing to start AI swap generation');
      return;
    }

    setIsGeneratingAISwaps(true);
    beginGeneration();

    try {
      const dayName = DAYS[swapDayIndex];
      const context = await loadDayContext();
      // Three parallel one-recipe requests, each with its own slot, so the
      // suggestions differ from each other as well as from the week (#95).
      const results = await Promise.all(
        [0, 1, 2].map(() => generateDay({ ...context, slot: slotForDay(swapDayIndex, context) }))
      );
      if (results.some((r) => !r.ok && r.redirected)) return;

      const found = results.flatMap((r) => (r.ok ? [r] : []));
      if (found.length === 0) {
        const failure = results.find((r) => !r.ok);
        throw new Error(failure && !failure.ok ? failure.error : apiErrorMessage(null));
      }
      await RecipeLibrary.addTempAIRecipes(found.map((r) => r.recipe));

      setSuggestedSwaps(found.map((r) => r.recipe));
      setSwapExplanations(
        Object.fromEntries(found.flatMap((r) => (r.explanation ? [[r.recipe.id, r.explanation]] : [])))
      );
      track('swap', {
        day: dayName,
        oldRecipeId: weekPlanRef.current[swapDayIndex]?.recipeId || 'unknown',
        newRecipeId: 'ai_suggestions_generated',
      });
    } catch (error) {
      console.error('❌ Error generating AI swaps:', error);
      setGenerationError(error instanceof Error ? error.message : apiErrorMessage(null));
    } finally {
      setIsGeneratingAISwaps(false);
      endGeneration();
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
    
    const reasons = mealReasons(recipe, household.favorites);
    
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
      // Only AI suggestions carry a line; a saved recipe picked from the drawer has none.
      explanation: swapExplanations[recipe.id],
      nutrition: recipe.nutrition,
    };
    
    // Update the meal plan
    const newWeekPlan = [...weekPlanRef.current];
    newWeekPlan[swapDayIndex] = newMeal;
    commitPlan(newWeekPlan);
    
    // Save updated week plan
    const nextWeekISO = nextWeekMondayISO();
    await persistPlan(pantryItems);
    recordWeekHistory(nextWeekISO, [recipe.id]).catch((err) => console.warn('Could not record recipe history:', err));
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
    const newWeekPlan = [...weekPlanRef.current];
    newWeekPlan[dayIndex] = null;
    commitPlan(newWeekPlan);
    
    // Save updated week plan
    await persistPlan(pantryItems);
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
    const newWeekPlan = [...weekPlanRef.current];
    const [movedMeal] = newWeekPlan.splice(oldIndex, 1);
    newWeekPlan.splice(newIndex, 0, movedMeal);
    
    commitPlan(newWeekPlan);
    // Errors and retry slots belong to a day; once meals move, empty days just offer Generate.
    failedSlotsRef.current = {};
    setDayErrors({});
    
    // Save updated week plan
    await persistPlan(pantryItems);
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
    setPantryItems(wizardData.pantryItems);
    setUseSoon(wizardData.useSoonItems);
    setShowWizard(false);

    const familySettings = await getFamilySettings();
    // This week's cuisines and chef from the wizard, for this plan only.
    const weeklySettings = {
      ...familySettings,
      cuisines: wizardData.cuisines.length > 0 ? wizardData.cuisines : familySettings.cuisines,
      preferredChef: wizardData.preferredChef || familySettings.preferredChef,
    };
    const ok = await generateWeek(weeklySettings, wizardData.pantryItems, wizardData.useSoonItems);
    if (!ok) setShowWizard(true);
  };

  const handleScanPantryImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanError(null);

    try {
      console.log('📸 Scanning pantry image:', file.name);

      // Resized on the client to stay well under Vercel's 4.5 MB body limit (#82).
      const formData = await imageUploadFormData(file);

      const response = await fetch('/api/scan-pantry-image', {
        method: 'POST',
        body: formData,
      });

      if (redirectToLoginIfUnauthenticated(response)) return;
      // Vercel's 413 body isn't our JSON, so handle it before parsing.
      if (response.status === 413) throw new PhotoTooLargeError();

      const data = await response.json().catch(() => null);

      if (!response.ok || !data || data.error) {
        throw new Error(apiErrorMessage(data));
      }

      console.log('✅ Ingredients detected:', data.items);

      // Add detected ingredients to pantry items (avoiding duplicates), with their use-soon flags
      const merged = mergeScan({ items: pantryItems, useSoon }, data.items);
      setPantryItems(merged.items);
      setUseSoon(merged.useSoon);


    } catch (error) {
      console.error('❌ Error scanning image:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to scan image';
      setScanError(errorMessage);
    } finally {
      setIsScanning(false);
      // Clear the input even after an error, so picking the same photo again still fires onChange.
      event.target.value = '';
    }
  };

  const handleGenerateWithAI = async () => {
    const familySettings = await getFamilySettings();
    await generateWeek(familySettings, pantryItems, itemsToUseSoon({ items: pantryItems, useSoon }));
  };

  /** Settings, pantry and taste for a request outside a fresh plan (single day, retry, swap). */
  const loadDayContext = async (): Promise<Omit<DayRequest, 'slot'>> => ({
    // The plan's own settings within a session (e.g. the wizard's cuisines);
    // the pantry as it is now, edits included; taste counting this week's meals.
    familySettings: planSettingsRef.current ?? (await getFamilySettings()),
    pantryItems,
    useSoonItems: itemsToUseSoon({ items: pantryItems, useSoon }),
    tasteSignals: await loadTasteSignals(weekPlanRef.current),
  });

  /** A fresh slot for one day, against the proteins and cuisines on the rest of the week. */
  const slotForDay = (dayIndex: number, context: Omit<DayRequest, 'slot'>): DaySlot => {
    const plan = weekPlanRef.current;
    const recipes = plan.map((meal) => (meal ? RecipeLibrary.getById(meal.recipeId) : undefined));
    return buildDaySlot({
      settings: context.familySettings,
      cuisines: context.familySettings.cuisines,
      pantryItems: context.pantryItems,
      useSoonItems: context.useSoonItems,
      seed: newSlateSeed(),
      index: dayIndex,
      weekProteins: plan.map((meal, i) => (meal ? slotByRecipeRef.current.get(meal.recipeId)?.protein ?? proteinOf(recipes[i]) : null)),
      weekCuisines: plan.map((meal, i) => (meal ? recipes[i]?.cuisine ?? slotByRecipeRef.current.get(meal.recipeId)?.cuisine : null)),
    });
  };

  /**
   * Generates and shows one day, returning its meal, or null on failure with
   * the error shown on that day. Doesn't save: callers save once.
   */
  const runDay = async (context: Omit<DayRequest, 'slot'>, slot: DaySlot): Promise<MealCardProps | null> => {
    const index = slot.index;
    setGeneratingDays((days) => (days.includes(index) ? days : [...days, index]));
    setDayErrors((errors) => {
      const next = { ...errors };
      delete next[index];
      return next;
    });
    delete failedSlotsRef.current[index];
    try {
      const result = await generateDay({ ...context, slot });
      if (!result.ok) {
        failedSlotsRef.current[index] = slot;
        if (!result.redirected) setDayErrors((errors) => ({ ...errors, [index]: result.error }));
        return null;
      }
      slotByRecipeRef.current.set(result.recipe.id, slot);
      await RecipeLibrary.addTempAIRecipes([result.recipe]);
      const meal = toAiMeal(result.recipe, result.explanation);
      const next = [...weekPlanRef.current];
      next[index] = meal;
      commitPlan(next);
      setAriaLiveMessage(`${DAYS[index]}: ${result.recipe.title}`);
      return meal;
    } finally {
      setGeneratingDays((days) => days.filter((d) => d !== index));
    }
  };

  /** Saves the plan as it stands; records history and ingredient use for `newIds`; returns its cost. */
  const savePlan = async (newIds: string[], familySettings: FamilySettings, pantry: string[]): Promise<number> => {
    const saved = await persistPlan(pantry);
    if (!saved) console.warn('⚠️ Failed to save week plan');
    const plan = weekPlanRef.current;
    if (newIds.length > 0) {
      recordWeekHistory(nextWeekMondayISO(), newIds).catch((err) => console.warn('Could not record recipe history:', err));
      trackIngredientUsage(newIds);
    }
    const recipes = plan.flatMap((meal) => {
      const recipe = meal ? RecipeLibrary.getById(meal.recipeId) : undefined;
      return recipe ? [recipe] : [];
    });
    setBudgetPerMeal(familySettings.budgetPerMeal.max);
    return summarisePlan(recipes, familySettings.budgetPerMeal.max).cost;
  };

  /**
   * A full 7-day plan (#95): the lineup is chosen in code, then every day is
   * generated in parallel and shown as soon as it arrives. Saves once all
   * days have settled; failed days stay empty with a Retry button.
   * Returns false if no day could be generated.
   */
  const generateWeek = async (familySettings: FamilySettings, pantry: string[], useSoonItems: string[]): Promise<boolean> => {
    if (isSignOutInProgress) {
      console.warn('Sign-out in progress, refusing to start plan generation');
      return false;
    }
    setIsGenerating(true);
    beginGeneration();
    setGenerationError(null);
    setAriaLiveMessage("Generating weekly meal plan...");
    const startedAt = performance.now();
    // Taste comes from the plan being replaced; skeletons show straight away.
    const previousPlan = weekPlanRef.current;
    commitPlan(Array(7).fill(null));
    slotByRecipeRef.current.clear();
    failedSlotsRef.current = {};
    setDayErrors({});
    setGeneratingDays([0, 1, 2, 3, 4, 5, 6]);

    try {
      const tasteSignals = await loadTasteSignals(previousPlan);
      const recentCuisines = getRecentRecipeIds()
        .map((id) => RecipeLibrary.getById(id)?.cuisine)
        .filter((cuisine): cuisine is string => Boolean(cuisine));
      const slate = buildWeekSlate({
        settings: familySettings,
        cuisines: familySettings.cuisines,
        pantryItems: pantry,
        useSoonItems,
        recentCuisines,
        seed: newSlateSeed(),
      });
      console.log('🗓️ Week lineup:', slate);

      const context = { familySettings, pantryItems: pantry, useSoonItems, tasteSignals };
      planSettingsRef.current = familySettings;

      let firstCardMs: number | null = null;
      const settled = await Promise.allSettled(
        slate.map(async (slot) => {
          const meal = await runDay(context, slot);
          if (meal && firstCardMs === null) firstCardMs = performance.now() - startedAt;
          return meal;
        })
      );
      const newIds = settled.flatMap((r) => (r.status === 'fulfilled' && r.value ? [r.value.recipeId] : []));
      console.log('⏱️ Week generation timings (ms):', {
        firstCard: firstCardMs === null ? null : Math.round(firstCardMs),
        fullWeek: Math.round(performance.now() - startedAt),
        days: newIds.length,
      });

      if (newIds.length === 0) {
        setGenerationError("We couldn't generate your plan. Please try again.");
        setAriaLiveMessage("We couldn't generate your plan. Please try again.");
        return false;
      }

      const cost = await savePlan(newIds, familySettings, pantry);
      setAriaLiveMessage(
        newIds.length === 7
          ? "Weekly meal plan generated successfully!"
          : `Generated ${newIds.length} of 7 days. You can retry the others.`
      );
      track('plan_composed', {
        dayCount: newIds.length,
        pantryItemCount: pantry.length,
        cuisineCount: familySettings.cuisines.length,
        cost,
        conflicts: 0,
        leftoverDays: 0,
        proteinVariety: new Set(slate.map((slot) => slot.protein)).size,
      });
      return true;
    } catch (error) {
      console.error('❌ Error generating plan:', error);
      setGenerationError(apiErrorMessage(null));
      return false;
    } finally {
      setGeneratingDays([]);
      setIsGenerating(false);
      endGeneration();
    }
  };

  /** One day: a fresh slot for an empty day ("Generate"), or the same slot again ("Retry"). */
  const generateOneDay = async (dayIndex: number, retry: boolean) => {
    if (isSignOutInProgress) {
      console.warn('Sign-out in progress, refusing to start recipe generation');
      return;
    }
    beginGeneration();
    setGenerationError(null);
    setAriaLiveMessage(`Generating AI recipe for ${DAYS[dayIndex]}...`);
    try {
      const context = await loadDayContext();
      const slot = (retry && failedSlotsRef.current[dayIndex]) || slotForDay(dayIndex, context);
      const meal = await runDay(context, slot);
      if (meal) {
        await savePlan([meal.recipeId], context.familySettings, context.pantryItems);
        track('swap', { day: DAYS[dayIndex], oldRecipeId: 'empty', newRecipeId: meal.recipeId });
      }
    } catch (error) {
      console.error('❌ Error generating recipe:', error);
      setDayErrors((errors) => ({ ...errors, [dayIndex]: apiErrorMessage(null) }));
    } finally {
      endGeneration();
    }
  };

  const handleGenerateSingleRecipe = (dayIndex: number) => generateOneDay(dayIndex, false);
  const handleRetryDay = (dayIndex: number) => generateOneDay(dayIndex, true);

  // The header's one-line summary and the Details sheet (#38), derived from the plan itself.
  const planRecipes = useMemo(
    () =>
      weekPlan.flatMap((meal) => {
        const recipe = meal ? RecipeLibrary.getById(meal.recipeId) : undefined;
        return recipe ? [recipe] : [];
      }),
    [weekPlan]
  );
  const summary = useMemo(() => summarisePlan(planRecipes, budgetPerMeal), [planRecipes, budgetPerMeal]);
  const weekLabel = new Date(`${nextWeekMondayISO()}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  const planBusy = isGenerating || generatingDays.length > 0 || isGeneratingAISwaps;

  /** Confirm the week (#38, moved from /plan/review); see lib/client/confirmPlan.ts. */
  const [isConfirming, setIsConfirming] = useState(false);
  const handleConfirmPlan = async () => {
    setIsConfirming(true);
    const confirmed = await confirmPlan(
      weekPlanRef.current.flatMap((meal) => (meal ? [meal.recipeId] : [])),
      summary.cost,
      {
        pendingSaves: saveChainRef.current,
        markConfirmed: (ids) => RecipeLibrary.markRecipesAsConfirmed(ids),
        track: (meta) => track('plan_confirmed', meta),
        navigate: (path) => router.push(path),
      }
    );
    if (!confirmed) setIsConfirming(false);
  };

  return (
    <Main maxWidth="960px">
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
        <Stack direction="column" gap="lg">
          {/* Header: the week, a one-line summary, and the plan's actions (#38) */}
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" wrap gap="md">
            <Stack direction="column" gap="xs">
              <Typography variant="h1">Week of {weekLabel}</Typography>
              {summary.dinners > 0 && (
                <Typography variant="body" color="subdued">
                  {formatPlanSummary(summary)}
                </Typography>
              )}
            </Stack>
            <Stack direction="row" gap="sm" alignItems="center" wrap>
              <Badge count={pantryItems.length}>
                <Button variant="secondary" size="medium" onClick={() => setShowPantrySheet(true)}>
                  Pantry
                </Button>
              </Badge>
              <Button
                variant="secondary"
                size="medium"
                onClick={() => setShowDetails(true)}
                disabled={summary.dinners === 0}
              >
                Details
              </Button>
              <Button
                variant="primary"
                size="medium"
                onClick={handleConfirmPlan}
                // Confirm the week once it's settled, not mid-generation.
                disabled={summary.dinners === 0 || planBusy || isConfirming}
              >
                {isConfirming ? 'Confirming...' : 'Confirm plan'}
              </Button>
            </Stack>
          </Stack>

          {generationError && (
            <Alert variant="error">
              {generationError}
            </Alert>
          )}

          <WeekPlanList
            meals={weekPlan}
            // While a week generates, days fill in out of order: hold edits until it settles (#95).
            onSwapClick={isGenerating ? undefined : handleSwapClick}
            onGenerateClick={isGenerating ? undefined : handleGenerateSingleRecipe}
            onAddSavedRecipeClick={isGenerating ? undefined : handleAddSavedRecipe}
            generatingDays={generatingDays}
            dayErrors={dayErrors}
            onRetryDay={isGenerating ? undefined : handleRetryDay}
            onDeleteClick={isGenerating ? undefined : handleDeleteMeal}
            isGeneratingPlan={isLoadingInitial}
            onReorder={isGenerating ? undefined : handleReorder}
          />

          {/* Starting over sits after the week, apart from Confirm plan */}
          <ButtonGroup
            left={
              <Button variant="secondary" size="medium" iconName="refresh" onClick={() => setShowWizard(true)}>
                Start new week
              </Button>
            }
            right={
              <Button
                variant="secondary"
                size="medium"
                onClick={handleGenerateWithAI}
                // A week can't start while a day or swap is still in flight (#95).
                disabled={planBusy}
              >
                {isGenerating ? 'Generating...' : 'Regenerate whole week'}
              </Button>
            }
          />
        </Stack>
      )}

      <PlanDetailsSheet
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        weekPlan={weekPlan}
        summary={summary}
        dayNames={DAYS}
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
        explanations={swapExplanations}
        onSelectSwap={handleSelectSwap}
        onGenerateAISuggestions={handleGenerateAISwaps}
        isGeneratingAI={isGeneratingAISwaps}
      />

      <PantrySheet
        isOpen={showPantrySheet}
        onClose={() => setShowPantrySheet(false)}
        pantry={{ items: pantryItems, useSoon }}
        onUpdatePantry={handleUpdatePantry}
        onScanImage={handleScanPantryImage}
        isScanning={isScanning}
        scanError={scanError}
      />
    </Main>
  );
}