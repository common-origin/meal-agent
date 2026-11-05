-- Migration: Coles online order history (issue #185)
--
-- 1. purchase_history: one row per product line of a past Coles online
--    order, read by the extension from the user's logged-in coles.com.au
--    session. Holds the price actually paid, and which ingredient the
--    product is for once matched. Rows older than 12 months are deleted by
--    the import (/api/coles/purchases).
-- 2. household_products.source: whether a remembered product was chosen by
--    the user in the extension ('chosen', via Find/Change) or picked from
--    order history ('imported'). An import never replaces a chosen product.

CREATE TABLE IF NOT EXISTS public.purchase_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  -- Coles order number.
  order_id TEXT NOT NULL,
  ordered_at TIMESTAMPTZ NOT NULL,
  -- Coles stockcode, the number at the end of the product URL.
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  brand TEXT NULL,
  size TEXT NULL,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC(10,2) NULL,
  total_price NUMERIC(10,2) NULL,
  -- Canonical ingredient key from lib/ingredients (#183), once matched.
  ingredient_key TEXT NULL,
  -- How ingredient_key was decided:
  --   'alias'      matched a catalogue name, saved directly
  --   'suggested'  AI suggested suggested_key; waiting for the user
  --   'confirmed'  the user accepted the suggestion
  --   'rejected'   the user rejected it
  --   'none'       not an ingredient (or AI found no match)
  --   'pending'    not looked at yet
  match_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (match_status IN ('alias', 'suggested', 'confirmed', 'rejected', 'none', 'pending')),
  suggested_key TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(household_id, order_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_purchase_history_household_key ON public.purchase_history(household_id, ingredient_key);
CREATE INDEX IF NOT EXISTS idx_purchase_history_household_product ON public.purchase_history(household_id, product_id);

ALTER TABLE public.purchase_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their purchase history"
  ON public.purchase_history FOR SELECT
  USING (household_id = public.get_user_household_id());

CREATE POLICY "Users can add their purchase history"
  ON public.purchase_history FOR INSERT
  WITH CHECK (household_id = public.get_user_household_id());

CREATE POLICY "Users can update their purchase history"
  ON public.purchase_history FOR UPDATE
  USING (household_id = public.get_user_household_id());

CREATE POLICY "Users can delete their purchase history"
  ON public.purchase_history FOR DELETE
  USING (household_id = public.get_user_household_id());

ALTER TABLE public.household_products
ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'chosen'
  CHECK (source IN ('chosen', 'imported'));

COMMENT ON COLUMN public.household_products.source IS 'chosen: picked by the user in the Coles extension. imported: the most-bought product from order history (#185); replaced by later imports, never over a chosen one.';
