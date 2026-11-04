-- Migration: Coles side-panel extension (issue #184)
--
-- 1. households.extension_token: a revocable secret the Chrome extension
--    sends instead of a session, following the ics_token pattern (migration
--    006) but kept separate, so rotating one doesn't break the other.
-- 2. household_products: which Coles product a household buys for each
--    ingredient, learned from what the user adds to their trolley, so the
--    next week's shop can pre-tick it.
--
-- The approved shopping list itself goes in the existing shopping_lists
-- table (001), one row per household and week.

ALTER TABLE public.households
ADD COLUMN IF NOT EXISTS extension_token UUID NOT NULL DEFAULT uuid_generate_v4();

CREATE UNIQUE INDEX IF NOT EXISTS idx_households_extension_token ON public.households(extension_token);

COMMENT ON COLUMN public.households.extension_token IS 'Opaque secret the Coles Chrome extension sends as a bearer token (/api/coles/*) in place of a session. Rotated from Settings.';

CREATE TABLE IF NOT EXISTS public.household_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  -- Canonical ingredient key from lib/ingredients (#183), e.g. 'canned tomato'.
  ingredient_key TEXT NOT NULL,
  -- Coles stockcode, the number at the end of the product URL.
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  pack_size NUMERIC NULL,
  pack_unit TEXT NULL,
  url TEXT NULL,
  last_price NUMERIC(10,2) NULL,
  times_bought INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(household_id, ingredient_key)
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.household_products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.household_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their household products"
  ON public.household_products FOR SELECT
  USING (household_id = public.get_user_household_id());

CREATE POLICY "Users can add their household products"
  ON public.household_products FOR INSERT
  WITH CHECK (household_id = public.get_user_household_id());

CREATE POLICY "Users can update their household products"
  ON public.household_products FOR UPDATE
  USING (household_id = public.get_user_household_id());

CREATE POLICY "Users can delete their household products"
  ON public.household_products FOR DELETE
  USING (household_id = public.get_user_household_id());
