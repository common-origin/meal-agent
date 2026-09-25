-- Migration: Add recipe_history table
-- Backs cross-device recipe-repeat variety enforcement (issue #2): recencyTracker.ts
-- previously wrote this data to localStorage only, so a second device had no memory
-- of what was cooked recently and variety enforcement silently reset per device.
-- One row per recipe used in a composed week, mirroring recencyTracker.ts's
-- RecipeHistory shape (recipeId, weekOfISO, usedAt) so hybridStorage.ts can merge
-- Supabase rows into the existing localStorage history without changing its format.

CREATE TABLE IF NOT EXISTS public.recipe_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  recipe_id TEXT NOT NULL,
  week_start DATE NOT NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(household_id, recipe_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_recipe_history_household_week ON public.recipe_history(household_id, week_start DESC);

ALTER TABLE public.recipe_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their household recipe history"
  ON public.recipe_history FOR SELECT
  USING (household_id = public.get_user_household_id());

CREATE POLICY "Users can log recipe history for their household"
  ON public.recipe_history FOR INSERT
  WITH CHECK (household_id = public.get_user_household_id());

-- Needed for the upsert in saveRecipeHistoryEntries: re-generating the same
-- week multiple times should update that recipe's used_at, not accumulate a
-- duplicate row (the local recencyTracker.ts cache dedupes the same way).
CREATE POLICY "Users can update their household recipe history"
  ON public.recipe_history FOR UPDATE
  USING (household_id = public.get_user_household_id());
