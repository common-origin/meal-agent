-- Migration: Change recipes.id from UUID to TEXT
-- This allows support for both UUID and semantic IDs like "ai-recipe-name"
-- Execute this in Supabase SQL Editor: https://supabase.com/dashboard/project/migfbyyftwgidbkwwyst/sql

-- Step 1: Drop the existing table (safe since we're in development)
-- WARNING: This will delete all existing recipe data
DROP TABLE IF EXISTS public.recipes CASCADE;

-- Step 2: Recreate with TEXT id
CREATE TABLE public.recipes (
  id TEXT PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_url TEXT,
  source_domain TEXT NOT NULL DEFAULT 'ai-generated',
  source_chef TEXT,
  time_mins INTEGER NOT NULL,
  serves INTEGER NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  ingredients JSONB NOT NULL,
  instructions TEXT[],
  cost_per_serve_est NUMERIC(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 3: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_recipes_household_id ON public.recipes(household_id);
CREATE INDEX IF NOT EXISTS idx_recipes_tags ON public.recipes USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_recipes_created_at ON public.recipes(created_at DESC);

-- Step 4: Recreate updated_at trigger
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Step 5: Enable RLS
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

-- Step 6: Recreate RLS policies (from 002_rls_policies.sql)
CREATE POLICY "Users can view recipes from their household"
  ON public.recipes FOR SELECT
  TO authenticated
  USING (household_id = get_user_household_id());

CREATE POLICY "Users can insert recipes to their household"
  ON public.recipes FOR INSERT
  TO authenticated
  WITH CHECK (household_id = get_user_household_id());

CREATE POLICY "Users can update recipes in their household"
  ON public.recipes FOR UPDATE
  TO authenticated
  USING (household_id = get_user_household_id())
  WITH CHECK (household_id = get_user_household_id());

CREATE POLICY "Users can delete recipes from their household"
  ON public.recipes FOR DELETE
  TO authenticated
  USING (household_id = get_user_household_id());
