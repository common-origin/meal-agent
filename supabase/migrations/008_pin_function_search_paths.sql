-- Migration: Pin search_path on SECURITY DEFINER functions (issue #53)
-- `handle_new_user()` and `get_user_household_id()` are SECURITY DEFINER
-- (they run with the privileges of the function owner, not the caller) but
-- were declared without a pinned search_path. That's the exact pattern
-- Supabase's database linter flags as "Function Search Path Mutable":
-- https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable
-- A SECURITY DEFINER function without a pinned search_path can have its
-- unqualified identifier resolution hijacked by a search_path the caller
-- controls. Every reference in both functions is already schema-qualified
-- (public.households, public.household_members, etc.), so there's no
-- demonstrated exploit today -- this is a hardening fix, not a rollback of
-- a known incident.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_household_id UUID;
BEGIN
  -- Create a new household for this user
  INSERT INTO public.households (name)
  VALUES ('My Household')
  RETURNING id INTO new_household_id;

  -- Add user as owner of their household
  INSERT INTO public.household_members (household_id, user_id, role)
  VALUES (new_household_id, NEW.id, 'owner');

  -- Create default family settings
  INSERT INTO public.family_settings (household_id)
  VALUES (new_household_id);

  -- Create empty pantry preferences
  INSERT INTO public.pantry_preferences (household_id)
  VALUES (new_household_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.get_user_household_id()
RETURNS UUID AS $$
  SELECT household_id
  FROM public.household_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;
