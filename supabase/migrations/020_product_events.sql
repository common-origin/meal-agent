-- Migration: product_events, anonymous usage events (issue #247, initiative #244)
--
-- One row per whitelisted usage event (plan composed, confirmed, swap, ...).
-- Rows carry the pseudonymous household_id and never a user_id, and `props`
-- holds only numbers, enums and a `weekStart` date: the server validates each
-- event type with a strict schema before inserting. No recipe IDs, titles,
-- names or emails. household_id is unlinked (set null) if the household is
-- deleted.
--
-- Run this before deploying #247. Until it exists the app still works: events
-- are best-effort, so each failed insert only logs a warning.
--
-- Replaces purge_telemetry() (from 019) so it also trims product_events,
-- which is kept 400 days (about a year plus a margin, for year-on-year
-- comparison); app_errors stays at 90 days.

CREATE TABLE IF NOT EXISTS public.product_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  household_id UUID REFERENCES public.households(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  props JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Short git SHA of the deployment ('dev' locally).
  release TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_events_created ON public.product_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_events_type_created ON public.product_events(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_events_household_created ON public.product_events(household_id, created_at DESC);

-- RLS on with no policies: only the service role (which bypasses RLS) can use this table.
ALTER TABLE public.product_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.purge_telemetry()
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted INTEGER := 0;
  v_count INTEGER;
BEGIN
  IF to_regclass('public.app_errors') IS NOT NULL THEN
    DELETE FROM public.app_errors WHERE created_at < now() - interval '90 days';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted := v_deleted + v_count;
  END IF;
  IF to_regclass('public.product_events') IS NOT NULL THEN
    DELETE FROM public.product_events WHERE created_at < now() - interval '400 days';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted := v_deleted + v_count;
  END IF;
  RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_telemetry() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_telemetry() TO service_role;
