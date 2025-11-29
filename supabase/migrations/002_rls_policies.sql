-- Row-Level Security (RLS) Policies
-- Execute this AFTER running 001_initial_schema.sql
-- These policies ensure users can only access data from their household

-- ============================================================================
-- ENABLE ROW-LEVEL SECURITY ON ALL TABLES
-- ============================================================================
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pantry_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTION: Get User's Household ID
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_household_id()
RETURNS UUID AS $$
  SELECT household_id 
  FROM public.household_members 
  WHERE user_id = auth.uid() 
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- HOUSEHOLDS POLICIES
-- Users can only see households they belong to
-- ============================================================================
CREATE POLICY "Users can view their own household"
  ON public.households FOR SELECT
  USING (
    id IN (
      SELECT household_id 
      FROM public.household_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their household name"
  ON public.households FOR UPDATE
  USING (
    id IN (
      SELECT household_id 
      FROM public.household_members 
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- HOUSEHOLD MEMBERS POLICIES
-- Users can view members of their household
-- ============================================================================
CREATE POLICY "Users can view their household members"
  ON public.household_members FOR SELECT
  USING (
    household_id = public.get_user_household_id()
  );

CREATE POLICY "Owners can add members to their household"
  ON public.household_members FOR INSERT
  WITH CHECK (
    household_id = public.get_user_household_id()
    AND EXISTS (
      SELECT 1 FROM public.household_members
      WHERE household_id = public.get_user_household_id()
      AND user_id = auth.uid()
      AND role = 'owner'
    )
  );

CREATE POLICY "Owners can remove members from their household"
  ON public.household_members FOR DELETE
  USING (
    household_id = public.get_user_household_id()
    AND EXISTS (
      SELECT 1 FROM public.household_members
      WHERE household_id = public.get_user_household_id()
      AND user_id = auth.uid()
      AND role = 'owner'
    )
  );

-- ============================================================================
-- FAMILY SETTINGS POLICIES
-- All household members can view and update family settings
-- ============================================================================
CREATE POLICY "Users can view their household settings"
  ON public.family_settings FOR SELECT
  USING (household_id = public.get_user_household_id());

CREATE POLICY "Users can update their household settings"
  ON public.family_settings FOR UPDATE
  USING (household_id = public.get_user_household_id());

CREATE POLICY "Users can insert their household settings"
  ON public.family_settings FOR INSERT
  WITH CHECK (household_id = public.get_user_household_id());

-- ============================================================================
-- RECIPES POLICIES
-- All household members can view, create, update, delete recipes
-- ============================================================================
CREATE POLICY "Users can view their household recipes"
  ON public.recipes FOR SELECT
  USING (household_id = public.get_user_household_id());

CREATE POLICY "Users can create recipes for their household"
  ON public.recipes FOR INSERT
  WITH CHECK (household_id = public.get_user_household_id());

CREATE POLICY "Users can update their household recipes"
  ON public.recipes FOR UPDATE
  USING (household_id = public.get_user_household_id());

CREATE POLICY "Users can delete their household recipes"
  ON public.recipes FOR DELETE
  USING (household_id = public.get_user_household_id());

-- ============================================================================
-- MEAL PLANS POLICIES
-- All household members can view, create, update, delete meal plans
-- ============================================================================
CREATE POLICY "Users can view their household meal plans"
  ON public.meal_plans FOR SELECT
  USING (household_id = public.get_user_household_id());

CREATE POLICY "Users can create meal plans for their household"
  ON public.meal_plans FOR INSERT
  WITH CHECK (household_id = public.get_user_household_id());

CREATE POLICY "Users can update their household meal plans"
  ON public.meal_plans FOR UPDATE
  USING (household_id = public.get_user_household_id());

CREATE POLICY "Users can delete their household meal plans"
  ON public.meal_plans FOR DELETE
  USING (household_id = public.get_user_household_id());

-- ============================================================================
-- SHOPPING LISTS POLICIES
-- All household members can view, create, update, delete shopping lists
-- ============================================================================
CREATE POLICY "Users can view their household shopping lists"
  ON public.shopping_lists FOR SELECT
  USING (household_id = public.get_user_household_id());

CREATE POLICY "Users can create shopping lists for their household"
  ON public.shopping_lists FOR INSERT
  WITH CHECK (household_id = public.get_user_household_id());

CREATE POLICY "Users can update their household shopping lists"
  ON public.shopping_lists FOR UPDATE
  USING (household_id = public.get_user_household_id());

CREATE POLICY "Users can delete their household shopping lists"
  ON public.shopping_lists FOR DELETE
  USING (household_id = public.get_user_household_id());

-- ============================================================================
-- PANTRY PREFERENCES POLICIES
-- All household members can view and update pantry preferences
-- ============================================================================
CREATE POLICY "Users can view their household pantry preferences"
  ON public.pantry_preferences FOR SELECT
  USING (household_id = public.get_user_household_id());

CREATE POLICY "Users can update their household pantry preferences"
  ON public.pantry_preferences FOR UPDATE
  USING (household_id = public.get_user_household_id());

CREATE POLICY "Users can insert their household pantry preferences"
  ON public.pantry_preferences FOR INSERT
  WITH CHECK (household_id = public.get_user_household_id());

-- ============================================================================
-- API USAGE POLICIES
-- All household members can view API usage (read-only for now)
-- ============================================================================
CREATE POLICY "Users can view their household API usage"
  ON public.api_usage FOR SELECT
  USING (household_id = public.get_user_household_id());

CREATE POLICY "Users can log API usage for their household"
  ON public.api_usage FOR INSERT
  WITH CHECK (household_id = public.get_user_household_id());

-- ============================================================================
-- GRANT PERMISSIONS
-- Grant authenticated users access to all tables
-- ============================================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ============================================================================
-- VERIFICATION
-- Test that RLS is working by querying as an authenticated user
-- ============================================================================
-- SELECT * FROM public.recipes; -- Should only return recipes from user's household
-- SELECT * FROM public.meal_plans; -- Should only return meal plans from user's household
