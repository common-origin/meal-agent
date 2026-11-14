"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Box, EmptyState, IconButton, Stack, Typography, Button, type AgentInputHandle } from "@common-origin/design-system";
import Main from "@/components/app/Main";
import ButtonGroup from "@/components/app/ButtonGroup";
import WeekPlanList from "@/components/app/WeekPlanList";
import PlanDetailsSheet from "@/components/app/PlanDetailsSheet";
import PlanEditBar from "@/components/app/PlanEditBar";
import SwapDrawer from "@/components/app/SwapDrawer";
import WeeklyPlanWizard, { type WeeklyPlanData } from "@/components/app/WeeklyPlanWizard";
import PantrySheet from "@/components/app/PantrySheet";
import { type MealCardProps } from "@/components/app/MealCard";
import { type Recipe } from "@/lib/types/recipe";
import { scheduleSundayToast, thisWeekMondayISO, shiftWeekISO, weekToOpen, defaultPlanningWeekISO, formatWeekRange, relativeWeekLabel, shouldPromptNextWeek } from "@/lib/schedule";
import { formatPlanSummary, summarisePlan } from "@/lib/planSummary";
import { loadHousehold, getDefaultHousehold, getRecipeRatings, getBlockedRecipes, getFavorites } from "@/lib/storage";
import { getFamilySettings, saveCurrentWeekPlan, loadCurrentWeekPlan, hydrateRecencyFromSupabase, recordWeekHistory, listPlannedWeeks, getFamilySettingsAndSetup } from "@/lib/hybridStorage";
import { SETUP_PATH } from "@/lib/types/settings";
import { getRecentRecipeIds } from "@/lib/recencyTracker";
import { buildTasteSignals, type TasteSignals } from "@/lib/tasteSignals";
import { itemsToUseSoon, mergeScan, type PantryState } from "@/lib/pantryItems";
import { buildDaySlot, buildWeekSlate, newSlateSeed, type DaySlot } from "@/lib/planSlate";
import { generateDay, weekFailure, type DayRequest } from "@/lib/client/generateDay";
import { confirmPlan } from "@/lib/client/confirmPlan";
import { clearShoppingComplete } from "@/lib/shoppingCompletion";
import { acceptPreview, changeCount, dropNight, isPreviewPending, proposeEdits, resolveNight, retryNight, type EditInstruction, type PlanEditPreview } from "@/lib/planEdit";
import type { FamilySettings } from "@/lib/types/settings";
import { RecipeLibrary } from "@/lib/library";
import { track } from "@/lib/analytics";
import { recipeSourceLabel } from "@/lib/recipeDisplay";
import { weekDateLabels } from "@/lib/dayCard";
import { trackIngredientUsage } from "@/lib/ingredientAnalytics";
import { useGenerationActivity } from "@/components/generation/GenerationActivityProvider";
import { apiErrorMessage, redirectToLoginIfUnauthenticated } from "@/lib/api/client";
import { scanPantryImage } from "@/lib/client/scanPantry";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** The edit request failed and its friendly message is already shown (#38). */
class EditRequestError extends Error {}

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

/** The source on a plan card: the recipe cards' label (#181), less "AI generated", which the plan doesn't show. */
function planSourceLabel(recipe: Recipe): string {
  const label = recipeSourceLabel(recipe);
  return label && label !== "AI generated" ? label : "";
}

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
  // The week the wizard opens on (#194); set each time it opens.
  const [wizardWeek, setWizardWeek] = useState<string>(() => defaultPlanningWeekISO());
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
    // Undo only covers the last typed edit, so any later change retires it (#38).
    setUndoPlan(null);
    return next;
  };
  // The slot each AI meal was generated for, by recipe ID, so it follows the
  // meal through reorders and swaps when new slots are built around it (#95).
  const slotByRecipeRef = useRef(new Map<string, DaySlot>());
  // A failed day's slot, by day, so "Retry this day" asks for the same thing.
  const failedSlotsRef = useRef<Record<number, DaySlot>>({});
  // Each failed day's message, as runDay last set it: read synchronously when a whole week fails (#171).
  const dayErrorTextRef = useRef<Record<number, string>>({});
  // The settings (e.g. the wizard's cuisines for this week) the current plan was generated with.
  const planSettingsRef = useRef<FamilySettings | null>(null);
  // Saves run one at a time, each writing the latest plan, so an earlier
  // save can't land after a later one and drop a day (#95).
  const saveChainRef = useRef<Promise<unknown>>(Promise.resolve());
  // The Monday of the week on screen (#194). Every save, history entry and
  // shopping list uses this, never "next Monday", so a plan stays on its week.
  const [weekStart, setWeekStart] = useState<string>(() => defaultPlanningWeekISO());
  const weekStartRef = useRef(weekStart);
  // Weeks from this one on that have a saved plan, so the wizard can say which it would replace.
  const [plannedWeeks, setPlannedWeeks] = useState<string[]>([]);
  const persistPlan = (pantry: string[]): Promise<boolean> => {
    // The week and plan as they are now: if the user has moved to another week by the time this
    // runs, this save still writes the plan it was made for, to that plan's week.
    const week = weekStartRef.current;
    const snapshot = weekPlanRef.current;
    const run = saveChainRef.current.then(async () => {
      const plan = weekStartRef.current === week ? weekPlanRef.current : snapshot;
      const saved = await saveCurrentWeekPlan(plan.map((meal) => meal?.recipeId || ""), week, pantry, planReasons(plan));
      if (saved) setPlannedWeeks((weeks) => (weeks.includes(week) ? weeks : [...weeks, week].sort()));
      return saved;
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
  // Editing by typing (#38): the open preview, the reply line, the input and one-step undo.
  const [preview, setPreview] = useState<PlanEditPreview | null>(null);
  const previewTokenRef = useRef(0);
  // Bumped whenever an instruction or retry changes the preview, so the review bar announces a replacement.
  const [previewRevision, setPreviewRevision] = useState(0);
  const editInputRef = useRef<AgentInputHandle>(null);
  const [editMessage, setEditMessage] = useState<{ text: string; tone: 'info' | 'error' } | null>(null);
  const [editInput, setEditInput] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [undoPlan, setUndoPlan] = useState<(MealCardProps | null)[] | null>(null);
  // This session's recent edits, so a follow-up ("lighter than that") has a referent.
  const editHistoryRef = useRef<{ instruction: string; summary: string }[]>([]);
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

  // Settles while a week loads, so the week arrows wait for it.
  const [isLoadingWeek, setIsLoadingWeek] = useState(false);

  /**
   * Makes `week` the week on screen (#194), clearing everything that belongs
   * to the week being left: failures, slots, an open edit preview, undo.
   */
  const enterWeek = (week: string) => {
    weekStartRef.current = week;
    setWeekStart(week);
    // Off screen straight away: the week being left must not stay editable under the new week's
    // dates, where an edit would save its meals over the new week's plan.
    commitPlan([]);
    slotByRecipeRef.current.clear();
    failedSlotsRef.current = {};
    dayErrorTextRef.current = {};
    setDayErrors({});
    planSettingsRef.current = null;
    previewTokenRef.current++;
    setPreview(null);
    setEditMessage(null);
    editHistoryRef.current = [];
    setGenerationError(null);
    setUseSoon([]);
  };

  /** Puts one week's saved plan on screen, or an empty week with a "Plan this week" action. */
  const showWeek = async (week: string) => {
    enterWeek(week);
    const savedPlan = await loadCurrentWeekPlan(week);
    // The user may have moved on to another week while this one loaded.
    if (weekStartRef.current !== week) return;

    if (!savedPlan) {
      commitPlan([]);
      return;
    }

    console.log('📋 Plan page: Loading saved plan for week of', week, savedPlan.recipeIds);
    const household = loadHousehold() || getDefaultHousehold();
    const meals: (MealCardProps | null)[] = savedPlan.recipeIds.map((recipeId, index) => {
      if (!recipeId) return null;

      const recipe = RecipeLibrary.getById(recipeId);
      if (!recipe) {
        console.warn(`❌ Recipe ${recipeId} not found in Supabase or localStorage`);
        return null;
      }

      return {
        recipeId: recipe.id,
        title: recipe.title,
        // Source name, without "AI generated", which the plan doesn't show
        chef: planSourceLabel(recipe),
        timeMins: recipe.timeMins || 0,
        conflicts: [],
        reasons: mealReasons(recipe, household.favorites),
        explanation: savedPlan.reasons?.[index] || undefined,
        nutrition: recipe.nutrition,
      };
    });

    commitPlan(meals);

    const validRecipeIds = savedPlan.recipeIds.filter((id) => Boolean(id));
    if (validRecipeIds.length > 0) {
      trackIngredientUsage(validRecipeIds);
    }

    if (savedPlan.pantryItems) {
      setPantryItems(savedPlan.pantryItems);
    }
  };

  useEffect(() => {
    track('page_view', { page: '/plan' });
    scheduleSundayToast();

    (async () => {
      setIsLoadingInitial(true);

      // Load data in parallel for faster initial render
      const { loadAllRecipes } = await import('@/lib/hybridStorage');

      const [supabaseRecipes, { settings: familySettings, needsSetup }, weeks] = await Promise.all([
        loadAllRecipes(),
        getFamilySettingsAndSetup(),
        listPlannedWeeks(thisWeekMondayISO()),
      ]);

      // A new household sets itself up before its first plan (#211).
      if (needsSetup) {
        router.replace(SETUP_PATH);
        return;
      }

      console.log(`📚 Loaded ${supabaseRecipes.length} recipes from Supabase`);

      // Sync to localStorage so RecipeLibrary.getById() can find them
      if (supabaseRecipes.length > 0) {
        RecipeLibrary.syncSupabaseRecipes(supabaseRecipes);
      }

      setBudgetPerMeal(familySettings.budgetPerMeal.max);
      setPlannedWeeks(weeks);

      // Today's week if planned, else the next planned one; at the weekend, the week ahead first (#194).
      const week = weekToOpen(weeks);
      if (week) {
        await showWeek(week);
      } else {
        // Nothing planned from this week on: straight into planning
        console.log('🧙 Plan page: No upcoming plan, showing wizard');
        setShowWizard(true);
      }

      setIsLoadingInitial(false);
    })();
  // Runs once on mount; showWeek only reads refs and setters.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Opens the planner on `week` (#195): its replace warning is the confirmation when it's planned. */
  const openPlanner = (week: string) => {
    setWizardWeek(week);
    setShowWizard(true);
    // Start over sits below the week, so the planner would otherwise open scrolled down
    window.scrollTo({ top: 0 });
  };

  /** "Plan this week" on an empty week, and "Start over" on a planned one: the week on screen. */
  const planWeekOnScreen = () => openPlanner(weekStartRef.current);

  /** The week arrows (#194): waits for any save in flight, then shows the week before or after. */
  const handleChangeWeek = async (offset: number) => {
    setIsLoadingWeek(true);
    try {
      await saveChainRef.current.catch(() => undefined);
      await showWeek(shiftWeekISO(weekStartRef.current, offset));
    } finally {
      setIsLoadingWeek(false);
    }
  };

  // Handler for updating pantry items
  const handleUpdatePantry = async ({ items, useSoon: soon }: PantryState) => {
    setPantryItems(items);
    setUseSoon(soon);
    
    // Save updated pantry items to storage
    await persistPlan(items);
    console.log('✅ Pantry items updated and saved');
  };

  // "Use a saved recipe" for a night: the drawer is your own recipes only (#38).
  const handleSwapClick = (dayIndex: number) => {
    if (!weekPlan[dayIndex]) return;
    setSwapDayIndex(dayIndex);
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
    const displayChef = planSourceLabel(recipe);
    
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
    const newWeekPlan = [...weekPlanRef.current];
    newWeekPlan[swapDayIndex] = newMeal;
    commitPlan(newWeekPlan);
    
    // Save updated week plan
    const week = weekStartRef.current;
    await persistPlan(pantryItems);
    recordWeekHistory(week, [recipe.id]).catch((err) => console.warn('Could not record recipe history:', err));
    console.log('✅ Week plan updated after swap');
    
    // Close drawer
    setSwapDayIndex(null);
  };

  const handleAddSavedRecipe = (dayIndex: number) => {
    console.log(`➕ Adding saved recipe for ${DAYS[dayIndex]}`);
    
    // Open swap drawer for adding a new recipe
    setSwapDayIndex(dayIndex);
    
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

  /** "Move to another night…" (#160): swaps two nights' meals, so no other night shifts. */
  const handleMoveNight = async (fromIndex: number, toIndex: number) => {
    const newWeekPlan = DAYS.map((_, day) => weekPlanRef.current[day] ?? null);
    const movedMeal = newWeekPlan[fromIndex];
    [newWeekPlan[fromIndex], newWeekPlan[toIndex]] = [newWeekPlan[toIndex], movedMeal];
    commitPlan(newWeekPlan);
    // As with a drag: errors and retry slots belong to a day
    failedSlotsRef.current = {};
    setDayErrors({});
    setAriaLiveMessage(`Moved to ${DAYS[toIndex]}.`);
    await persistPlan(pantryItems);
    track('meal_reordered', {
      fromDay: DAYS[fromIndex],
      toDay: DAYS[toIndex],
      recipeId: movedMeal?.recipeId || 'none',
    });
  };

  const handleWizardComplete = async (wizardData: WeeklyPlanData) => {
    console.log('🧙 Wizard completed with data:', wizardData);
    // The plan goes to the week chosen in the wizard (#194), after any save for the week on screen.
    await saveChainRef.current.catch(() => undefined);
    enterWeek(wizardData.weekStart);
    setPantryItems(wizardData.pantryItems);
    setUseSoon(wizardData.useSoonItems);
    setShowWizard(false);

    const familySettings = await getFamilySettings();
    // This week's cuisines and chef from the wizard, for this plan only.
    const weeklySettings = {
      ...familySettings,
      cuisines: wizardData.cuisines.length > 0 ? wizardData.cuisines : familySettings.cuisines,
      // The planner pre-fills this from Settings, so an empty field means "no chef this week"
      preferredChef: wizardData.preferredChef,
    };
    // Stays on the plan even if nothing generated: its alert says why, and the
    // nights offer Generate (going back to the wizard hid the alert, #171).
    await generateWeek(weeklySettings, wizardData.pantryItems, wizardData.useSoonItems, wizardData.nights);
  };

  const handleScanPantryImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanError(null);

    try {
      const items = await scanPantryImage(file);
      if (!items) return;
      // Add detected ingredients to pantry items (avoiding duplicates), with their use-soon flags
      const merged = mergeScan({ items: pantryItems, useSoon }, items);
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

  /** Settings, pantry and taste for a request outside a fresh plan (single day, retry, swap). */
  const loadDayContext = async (): Promise<Omit<DayRequest, 'slot'>> => ({
    // The plan's own settings within a session (e.g. the wizard's cuisines);
    // the pantry as it is now, edits included; taste counting this week's meals.
    familySettings: planSettingsRef.current ?? (await getFamilySettings()),
    pantryItems,
    useSoonItems: itemsToUseSoon({ items: pantryItems, useSoon }),
    tasteSignals: await loadTasteSignals(weekPlanRef.current),
  });

  /**
   * Fresh slots for some days, each against the proteins and cuisines on the
   * rest of the week, including the slots chosen before it here.
   */
  const slotsForDays = (dayIndices: number[], context: Omit<DayRequest, 'slot'>): DaySlot[] => {
    const plan = weekPlanRef.current;
    const recipes = plan.map((meal) => (meal ? RecipeLibrary.getById(meal.recipeId) : undefined));
    const weekProteins: (string | null | undefined)[] = plan.map((meal, i) =>
      meal ? slotByRecipeRef.current.get(meal.recipeId)?.protein ?? proteinOf(recipes[i]) : null
    );
    const weekCuisines: (string | null | undefined)[] = plan.map((meal, i) =>
      meal ? recipes[i]?.cuisine ?? slotByRecipeRef.current.get(meal.recipeId)?.cuisine : null
    );
    return dayIndices.map((index) => {
      const slot = buildDaySlot({
        settings: context.familySettings,
        cuisines: context.familySettings.cuisines,
        pantryItems: context.pantryItems,
        useSoonItems: context.useSoonItems,
        seed: newSlateSeed(),
        index,
        weekProteins,
        weekCuisines,
      });
      weekProteins[index] = slot.protein;
      weekCuisines[index] = slot.cuisine;
      return slot;
    });
  };

  /** A fresh slot for one day, against the proteins and cuisines on the rest of the week. */
  const slotForDay = (dayIndex: number, context: Omit<DayRequest, 'slot'>): DaySlot => slotsForDays([dayIndex], context)[0];

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
    delete dayErrorTextRef.current[index];
    try {
      const result = await generateDay({ ...context, slot });
      if (!result.ok) {
        failedSlotsRef.current[index] = slot;
        if (!result.redirected) {
          dayErrorTextRef.current[index] = result.error;
          setDayErrors((errors) => ({ ...errors, [index]: result.error }));
        }
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
      recordWeekHistory(weekStartRef.current, newIds).catch((err) => console.warn('Could not record recipe history:', err));
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
   * Returns false if no day could be generated. Only `nights` (0 = Monday)
   * are generated; the rest stay empty (#195).
   */
  const generateWeek = async (
    familySettings: FamilySettings,
    pantry: string[],
    useSoonItems: string[],
    nights: number[] = [0, 1, 2, 3, 4, 5, 6]
  ): Promise<boolean> => {
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
    dayErrorTextRef.current = {};
    setDayErrors({});
    setGeneratingDays(nights);

    try {
      const tasteSignals = await loadTasteSignals(previousPlan);
      const recentCuisines = getRecentRecipeIds()
        .map((id) => RecipeLibrary.getById(id)?.cuisine)
        .filter((cuisine): cuisine is string => Boolean(cuisine));
      // The whole week's lineup keeps its variety rules; only the chosen nights are generated
      const slate = buildWeekSlate({
        settings: familySettings,
        cuisines: familySettings.cuisines,
        pantryItems: pantry,
        useSoonItems,
        recentCuisines,
        seed: newSlateSeed(),
      }).filter((slot) => nights.includes(slot.index));
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
        // One alert on the plan, not seven copies of the same reason (#171)
        const failure = weekFailure(slate.flatMap((slot) => dayErrorTextRef.current[slot.index] ?? []));
        if (failure.foldNightErrors) setDayErrors({});
        setGenerationError(failure.message);
        setAriaLiveMessage(failure.message);
        return false;
      }

      const cost = await savePlan(newIds, familySettings, pantry);
      setAriaLiveMessage(
        newIds.length === slate.length
          ? "Weekly meal plan generated successfully!"
          : `Generated ${newIds.length} of ${slate.length} days. You can retry the others.`
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

  /** "Fill empty nights" (#160): every empty night, as Generate does for one, then one save. */
  const handleFillEmptyNights = async () => {
    if (isSignOutInProgress) {
      console.warn('Sign-out in progress, refusing to start recipe generation');
      return;
    }
    beginGeneration();
    setGenerationError(null);
    try {
      const context = await loadDayContext();
      // After the await, so a night filled meanwhile isn't generated over
      const emptyDays = DAYS.flatMap((_, day) => (weekPlanRef.current[day] ? [] : [day]));
      if (emptyDays.length === 0) return;
      setAriaLiveMessage(`Generating AI recipes for ${emptyDays.length} nights...`);
      const settled = await Promise.allSettled(slotsForDays(emptyDays, context).map((slot) => runDay(context, slot)));
      const meals = settled.flatMap((r) => (r.status === 'fulfilled' && r.value ? [r.value] : []));
      if (meals.length > 0) await savePlan(meals.map((meal) => meal.recipeId), context.familySettings, context.pantryItems);
      setAriaLiveMessage(
        meals.length === emptyDays.length
          ? `Filled ${meals.length} nights.`
          : `Filled ${meals.length} of ${emptyDays.length} nights. You can retry the others.`
      );
      emptyDays.forEach((day) => {
        const meal = weekPlanRef.current[day];
        if (meal) track('swap', { day: DAYS[day], oldRecipeId: 'empty', newRecipeId: meal.recipeId });
      });
    } catch (error) {
      console.error('❌ Error filling empty nights:', error);
      setGenerationError(apiErrorMessage(null));
    } finally {
      endGeneration();
    }
  };

  /** The plan as the edit model should see it: the open preview's proposals in place. */
  const planForEdit = () =>
    DAYS.map((_, day) => {
      const proposal = preview?.nights[day];
      const meal =
        proposal?.kind === 'remove' ? null : proposal?.status === 'ready' ? proposal.meal : weekPlanRef.current[day] ?? null;
      const recipe = meal ? RecipeLibrary.getById(meal.recipeId) : undefined;
      // Clipped to the request's limits: a saved recipe's title can be any length.
      const protein = meal ? slotByRecipeRef.current.get(meal.recipeId)?.protein ?? proteinOf(recipe) : null;
      return {
        day,
        title: meal ? meal.title.slice(0, 100) : null,
        cuisine: recipe?.cuisine?.slice(0, 40) ?? null,
        protein: protein?.slice(0, 60) ?? null,
      };
    });

  /** Generates one proposed night under `token`; the result lands only if that night still waits on it. */
  const generateProposal = async (context: Omit<DayRequest, 'slot'>, day: number, guidance: string | undefined, token: number) => {
    const slot = slotForDay(day, context);
    const result = await generateDay({ ...context, slot, guidance });
    if (result.ok) {
      await RecipeLibrary.addTempAIRecipes([result.recipe]);
      slotByRecipeRef.current.set(result.recipe.id, slot);
      setPreview((current) => resolveNight(current, day, token, { ok: true, meal: toAiMeal(result.recipe, result.explanation) }));
    } else if (!result.redirected) {
      setPreview((current) => resolveNight(current, day, token, { ok: false, error: result.error }));
    }
  };

  /** Generates a preview's replaced nights in the background, so the input stays free meanwhile. */
  const generateProposals = async (edits: EditInstruction[], token: number) => {
    beginGeneration();
    try {
      const context = await loadDayContext();
      await Promise.all(
        edits.filter((edit) => edit.action === 'replace').map((edit) => generateProposal(context, edit.day, edit.guidance, token))
      );
    } catch (error) {
      console.error('❌ Generating proposed nights failed:', error);
    } finally {
      endGeneration();
    }
  };

  /**
   * A typed change (#38): the edit model reads it into per-night edits, which
   * open (or refine) a preview. Resolves as soon as the instruction is read
   * (AgentInput then clears the field) and throws when it couldn't be, so
   * AgentInput keeps the text for another try. The replaced nights generate
   * separately, without blocking the next instruction.
   */
  const handleEditSubmit = async (instruction: string): Promise<void> => {
    if (editBusy || isSignOutInProgress) throw new Error('busy');
    setEditBusy(true);
    setEditMessage(null);
    beginGeneration();
    try {
      const response = await fetch('/api/edit-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction, plan: planForEdit(), history: editHistoryRef.current }),
      });
      if (redirectToLoginIfUnauthenticated(response)) return;
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || data.error) {
        setEditMessage({ text: apiErrorMessage(data), tone: 'error' });
        throw new EditRequestError();
      }

      const edits: EditInstruction[] = data.edits ?? [];
      if (data.question || edits.length === 0) {
        // Nothing changes yet: show the model's question or its reply.
        setEditMessage({ text: data.question ?? data.reply, tone: 'info' });
        return;
      }

      editHistoryRef.current = [...editHistoryRef.current, { instruction, summary: data.reply }].slice(-5);
      setEditMessage({ text: data.reply, tone: 'info' });
      const token = ++previewTokenRef.current;
      setPreview((current) => proposeEdits(current, edits, token));
      setPreviewRevision((revision) => revision + 1);
      track('plan_edit', { nights: edits.length, followUp: preview !== null });
      void generateProposals(edits, token);
    } catch (error) {
      if (!(error instanceof EditRequestError)) {
        console.error('❌ Plan edit failed:', error);
        setEditMessage({ text: apiErrorMessage(null), tone: 'error' });
      }
      throw error;
    } finally {
      setEditBusy(false);
      endGeneration();
    }
  };

  /** "Try again" on a proposed night that failed. */
  const handleRetryProposal = async (day: number) => {
    const night = preview?.nights[day];
    if (!night || night.kind !== 'replace') return;
    const token = ++previewTokenRef.current;
    setPreview((current) => (current ? retryNight(current, day, token) : current));
    setPreviewRevision((revision) => revision + 1);
    beginGeneration();
    try {
      await generateProposal(await loadDayContext(), day, night.guidance, token);
    } finally {
      endGeneration();
    }
  };

  /** "Keep as is" on a proposed night that failed: the plan keeps its meal there. */
  const handleKeepNight = (day: number) => {
    if (!preview) return;
    const next = dropNight(preview, day);
    // Keeping the last proposed night is a discard.
    if (!next) return handleDiscardEdit();
    setPreview(next);
    setPreviewRevision((revision) => revision + 1);
  };

  /** Apply the preview: one save, history for the new meals, and Undo on offer. */
  const handleAcceptEdit = async () => {
    if (!preview || isPreviewPending(preview)) return;
    const before = weekPlanRef.current;
    const { plan, newIds } = acceptPreview(before, preview);
    previewTokenRef.current++;
    setPreview(null);
    commitPlan(plan);
    setUndoPlan(before);
    const changed = changeCount(preview);
    setEditMessage({ text: `Updated ${changed} ${changed === 1 ? 'night' : 'nights'}.`, tone: 'info' });
    track('plan_edit_accepted', { nights: changed });
    const familySettings = planSettingsRef.current ?? (await getFamilySettings());
    await savePlan(newIds, familySettings, pantryItems);
  };

  const handleDiscardEdit = () => {
    previewTokenRef.current++;
    setPreview(null);
    editHistoryRef.current = [];
    setEditMessage({ text: 'Discarded. Your plan is unchanged.', tone: 'info' });
  };

  const handleUndoEdit = async () => {
    if (!undoPlan) return;
    commitPlan(undoPlan);
    editHistoryRef.current = [];
    setEditMessage({ text: 'Undone.', tone: 'info' });
    await persistPlan(pantryItems);
  };

  /** "Change this" on a meal: name the night in the input, ready to type (#38). */
  const handleChangeClick = (day: number) => {
    setEditInput(`${DAYS[day]}: `);
    // After the new value renders, so the caret lands after the night's name.
    requestAnimationFrame(() => editInputRef.current?.focus({ cursor: 'end' }));
  };

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
  const weekDates = useMemo(() => weekDateLabels(weekStart), [weekStart]);
  const weekRelative = relativeWeekLabel(weekStart);
  // Confirm waits for generation and for an open edit preview (accept or discard it first).
  const planBusy = isGenerating || generatingDays.length > 0 || editBusy || preview !== null;

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
        clearShoppingComplete: () => clearShoppingComplete(weekStartRef.current),
        // The shopping list for this plan's week, whichever week that is (#194)
        navigate: (path) => router.push(`${path}?week=${weekStartRef.current}`),
      }
    );
    if (!confirmed) setIsConfirming(false);
  };

  return (
    <Main maxWidth="960px">
      {/* ARIA live region for screen reader announcements */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {ariaLiveMessage}
      </div>

      {showWizard ? (
        <WeeklyPlanWizard
          onComplete={handleWizardComplete}
          // Cancel just closes the wizard, back to the week on screen (#194). It used to
          // generate a plan, which would now land on whichever week was showing.
          onCancel={() => setShowWizard(false)}
          initialWeek={wizardWeek}
          plannedWeeks={plannedWeeks}
        />
      ) : (
        <Stack direction="column" gap="lg">
          {/* Header: the week, a one-line summary, and the plan's actions (#38) */}
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" wrap gap="md">
            <Stack direction="column" gap="xs">
              {/* The week's dates, with arrows to the week before and after (#194) */}
              <Stack direction="row" gap="sm" alignItems="center">
                <IconButton
                  variant="naked"
                  size="medium"
                  iconName="arrowLeft"
                  aria-label="Previous week"
                  onClick={() => handleChangeWeek(-1)}
                  disabled={isLoadingInitial || isLoadingWeek || planBusy || isConfirming}
                />
                <Typography variant="h1">{formatWeekRange(weekStart)}</Typography>
                <IconButton
                  variant="naked"
                  size="medium"
                  iconName="arrowRight"
                  aria-label="Next week"
                  onClick={() => handleChangeWeek(1)}
                  disabled={isLoadingInitial || isLoadingWeek || planBusy || isConfirming}
                />
              </Stack>
              {/* Title plus a subdued line, composed from Typography in a Stack as the design system
                  documents (PageTitle was removed in 3.0). `small`, not `caption`: caption is uppercase. */}
              {(weekRelative || summary.dinners > 0) && (
                <Typography variant="small" color="subdued">
                  {[weekRelative, summary.dinners > 0 ? formatPlanSummary(summary) : null].filter(Boolean).join(' · ')}
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

          {/* Friday to Sunday, on this week, with next week unplanned (#195) */}
          {!isLoadingInitial && !isLoadingWeek && weekPlan.length > 0 && shouldPromptNextWeek(weekStart, plannedWeeks) && (
            <Box border="default" borderRadius="md" p="md">
              <Stack direction="row" gap="md" justifyContent="space-between" alignItems="center" wrap>
                <Stack direction="column" gap="xs">
                  <Typography variant="body"><strong>Next week isn&apos;t planned yet</strong></Typography>
                  <Typography variant="small" color="subdued">{formatWeekRange(shiftWeekISO(weekStart, 1))}</Typography>
                </Stack>
                <Button
                  variant="primary"
                  size="small"
                  onClick={() => openPlanner(shiftWeekISO(weekStartRef.current, 1))}
                  // Not while this week is generating: its days would land on the new week
                  disabled={planBusy}
                >
                  Plan next week
                </Button>
              </Stack>
            </Box>
          )}

          {/* A week with no saved plan (#194): offer to plan it, rather than seven empty nights */}
          {!isLoadingInitial && !isLoadingWeek && weekPlan.length === 0 ? (
            <EmptyState
              illustration="empty"
              title="No plan for this week yet"
              description={`Nothing is planned for ${formatWeekRange(weekStart)}.`}
              action={{ label: 'Plan this week', onClick: planWeekOnScreen, variant: 'primary' }}
            />
          ) : (
          <WeekPlanList
            meals={weekPlan}
            dates={weekDates}
            // While a week generates, days fill in out of order: hold edits until it settles (#95).
            // While an edit preview is open, nights stay put until it's accepted or discarded (#38).
            onSwapClick={isGenerating || preview ? undefined : handleSwapClick}
            onGenerateClick={isGenerating || preview ? undefined : handleGenerateSingleRecipe}
            onAddSavedRecipeClick={isGenerating || preview ? undefined : handleAddSavedRecipe}
            generatingDays={generatingDays}
            dayErrors={dayErrors}
            onRetryDay={isGenerating || preview ? undefined : handleRetryDay}
            onDeleteClick={isGenerating || preview ? undefined : handleDeleteMeal}
            isGeneratingPlan={isLoadingInitial || isLoadingWeek}
            // Not while any night is generating: its result lands by index, over a meal moved there
            onReorder={planBusy ? undefined : handleReorder}
            onMoveNight={planBusy ? undefined : handleMoveNight}
            onFillEmptyClick={planBusy ? undefined : handleFillEmptyNights}
            proposals={preview?.nights}
            onRetryProposal={handleRetryProposal}
            onKeepNight={handleKeepNight}
            onChangeClick={isGenerating ? undefined : handleChangeClick}
          />
          )}

          {/* Starting over sits after the week, apart from Confirm plan (#195: one action) */}
          {weekPlan.length > 0 && (
            <ButtonGroup
              left={
                <Button
                  variant="secondary"
                  size="medium"
                  iconName="refresh"
                  onClick={planWeekOnScreen}
                  // Not while a day or swap is still in flight (#95)
                  disabled={planBusy}
                >
                  Start over
                </Button>
              }
            />
          )}

          {/* Docked at the bottom: type what to change (#38) */}
          {/* Shown whenever a week is on screen, even with every night empty ("add something Friday") */}
          {!isLoadingInitial && weekPlan.length > 0 ? (
            <PlanEditBar
              ref={editInputRef}
              value={editInput}
              onChange={setEditInput}
              onSubmit={handleEditSubmit}
              message={editMessage}
              busy={editBusy}
              disabled={isGenerating}
              preview={
                preview
                  ? { id: String(previewRevision), changeCount: changeCount(preview), pending: isPreviewPending(preview) }
                  : null
              }
              onAccept={handleAcceptEdit}
              onDiscard={handleDiscardEdit}
              canUndo={undoPlan !== null}
              onUndo={handleUndoEdit}
            />
          ) : null}
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
        onSelectSwap={handleSelectSwap}
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