-- Migration: shared Coles lookup quota, counted on the server (issue #227)
--
-- Every household shares one RapidAPI key, whose plan allows a fixed number
-- of Coles lookups a month. Until now each browser counted its own calls, so
-- every household thought it had the whole quota. /api/coles-search now
-- claims a call here (one api_usage row) before calling RapidAPI, and is
-- refused once the month's total reaches the limit.
--
-- Run this before deploying #227: until these functions exist, the app
-- can't count lookups and refuses them (it fails closed), so prices fall
-- back to estimates.

-- Claims one call to `p_endpoint` for `p_household` if fewer than `p_limit`
-- calls have been made since `p_since`. Returns whether it was granted and
-- how many calls that makes (or have been made, when refused). The lock
-- serialises claims per endpoint, so simultaneous requests can't overshoot.
CREATE OR REPLACE FUNCTION public.claim_api_call(
  p_household UUID,
  p_endpoint TEXT,
  p_limit INTEGER,
  p_since TIMESTAMPTZ
)
RETURNS TABLE (granted BOOLEAN, used INTEGER)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_used INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('api_call:' || p_endpoint));
  SELECT count(*)::int INTO v_used FROM public.api_usage WHERE endpoint = p_endpoint AND "timestamp" >= p_since;
  IF v_used >= p_limit THEN
    RETURN QUERY SELECT false, v_used;
    RETURN;
  END IF;
  INSERT INTO public.api_usage (household_id, endpoint) VALUES (p_household, p_endpoint);
  RETURN QUERY SELECT true, v_used + 1;
END;
$$;

-- Calls to `p_endpoint` since `p_since`, across every household (for the quota banner).
CREATE OR REPLACE FUNCTION public.api_calls_since(p_endpoint TEXT, p_since TIMESTAMPTZ)
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT count(*)::int FROM public.api_usage WHERE endpoint = p_endpoint AND "timestamp" >= p_since;
$$;

-- Only the server (service role) claims or counts calls.
REVOKE ALL ON FUNCTION public.claim_api_call(UUID, TEXT, INTEGER, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.api_calls_since(TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_api_call(UUID, TEXT, INTEGER, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.api_calls_since(TEXT, TIMESTAMPTZ) TO service_role;

-- A member inserting rows directly could use up every household's quota.
-- Rows are written only through claim_api_call; members can still read theirs.
DROP POLICY IF EXISTS "Users can log API usage for their household" ON public.api_usage;

-- A deleted household's lookups were still spent at RapidAPI, so they keep
-- counting: the rows outlive the household (household_id set to NULL)
-- instead of being deleted with it.
ALTER TABLE public.api_usage ALTER COLUMN household_id DROP NOT NULL;
ALTER TABLE public.api_usage DROP CONSTRAINT IF EXISTS api_usage_household_id_fkey;
ALTER TABLE public.api_usage
  ADD CONSTRAINT api_usage_household_id_fkey
  FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE SET NULL;

-- The existing indexes lead with household_id or endpoint alone; this one serves the monthly count.
CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint_timestamp ON public.api_usage(endpoint, "timestamp");
