-- Meal Agent Database Schema
-- Execute this in Supabase SQL Editor: https://supabase.com/dashboard/project/migfbyyftwgidbkwwyst/sql

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- HOUSEHOLDS TABLE
-- Represents a household (family unit) that shares meal plans
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.households (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- HOUSEHOLD MEMBERS TABLE
-- Links users to households with their role
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.household_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(household_id, user_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_household_members_user_id ON public.household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_household_members_household_id ON public.household_members(household_id);

-- ============================================================================
-- FAMILY SETTINGS TABLE
-- Stores household preferences for meal generation
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.family_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE UNIQUE,
  total_servings INTEGER NOT NULL DEFAULT 4,
  adults INTEGER NOT NULL DEFAULT 2,
  kids INTEGER NOT NULL DEFAULT 0,
  kids_ages INTEGER[] NOT NULL DEFAULT '{}',
  cuisines TEXT[] NOT NULL DEFAULT '{}',
  dietary_restrictions TEXT[] NOT NULL DEFAULT '{}',
  cooking_time_preference TEXT NOT NULL DEFAULT 'medium',
  skill_level TEXT NOT NULL DEFAULT 'intermediate',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- RECIPES TABLE
-- Stores recipes (AI-generated or user-added)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_recipes_household_id ON public.recipes(household_id);
CREATE INDEX IF NOT EXISTS idx_recipes_tags ON public.recipes USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_recipes_created_at ON public.recipes(created_at DESC);

-- ============================================================================
-- MEAL PLANS TABLE
-- Stores weekly meal plans
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.meal_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  meals JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(household_id, week_start)
);

-- Index for faster lookups by household and week
CREATE INDEX IF NOT EXISTS idx_meal_plans_household_week ON public.meal_plans(household_id, week_start DESC);

-- ============================================================================
-- SHOPPING LISTS TABLE
-- Stores aggregated shopping lists for the week
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.shopping_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  items JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(household_id, week_start)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_shopping_lists_household_week ON public.shopping_lists(household_id, week_start DESC);

-- ============================================================================
-- PANTRY PREFERENCES TABLE
-- Stores items users always have in their pantry (exclude from shopping)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.pantry_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE UNIQUE,
  items TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- API USAGE TABLE
-- Track AI API usage for monitoring costs
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.api_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  tokens_used INTEGER,
  cost_usd NUMERIC(10, 6),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for usage analytics
CREATE INDEX IF NOT EXISTS idx_api_usage_household_timestamp ON public.api_usage(household_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint ON public.api_usage(endpoint);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- Automatically update updated_at timestamp on row updates
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables with updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.households
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.family_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.meal_plans
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.shopping_lists
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.pantry_preferences
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- FUNCTION: Create Household for New User
-- Automatically creates a household when a user signs up
-- ============================================================================
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run this to verify all tables were created:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- ORDER BY table_name;
