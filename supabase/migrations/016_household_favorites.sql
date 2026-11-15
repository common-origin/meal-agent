-- Migration: Household favourites (issue #222)
--
-- Favourites lived only in each browser's localStorage, so they didn't
-- follow a user to another device or reach other household members. This
-- table is now the source of truth; localStorage stays as the app's
-- synchronous cache (lib/hybridStorage.ts hydrateFavoritesFromSupabase).
--
-- recipe_id has no foreign key: built-in library recipes aren't in the
-- recipes table, and a favourite of a deleted recipe is harmless.

CREATE TABLE IF NOT EXISTS public.household_favorites (
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  recipe_id TEXT NOT NULL CHECK (char_length(recipe_id) BETWEEN 1 AND 200),
  created_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, recipe_id)
);

ALTER TABLE public.household_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view their household's favourites" ON public.household_favorites;
CREATE POLICY "Members can view their household's favourites"
  ON public.household_favorites FOR SELECT
  USING (household_id = public.get_user_household_id());

DROP POLICY IF EXISTS "Members can add their household's favourites" ON public.household_favorites;
CREATE POLICY "Members can add their household's favourites"
  ON public.household_favorites FOR INSERT
  WITH CHECK (household_id = public.get_user_household_id());

DROP POLICY IF EXISTS "Members can remove their household's favourites" ON public.household_favorites;
CREATE POLICY "Members can remove their household's favourites"
  ON public.household_favorites FOR DELETE
  USING (household_id = public.get_user_household_id());
