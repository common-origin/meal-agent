-- Migration: app_errors, the first admin-dashboard telemetry table (issue #245, initiative #244)
--
-- One row per server, route or client failure, with no personal info: the
-- route is a pattern (/app/api/plan/ics/[token]), never the actual path; the
-- message is scrubbed of emails, URLs, quoted strings and long id/digit runs
-- before it gets here; there is no user_id. household_id is pseudonymous and
-- is unlinked (set null) if the household is deleted.
--
-- Run this before deploying #245. Until it exists the app still works: error
-- capture is best-effort, so each failed insert only logs a warning.
--
-- Also adds purge_telemetry(), which deletes rows past their retention
-- (app_errors: 90 days). Later migrations replace it as tables are added.

CREATE TABLE IF NOT EXISTS public.app_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Short git SHA of the deployment ('dev' locally).
  release TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('server', 'route', 'client')),
  -- A route pattern, never an actual path.
  route TEXT,
  -- A developer-written static label for caught errors, e.g. 'coles-search: lookup failed'.
  label TEXT,
  kind TEXT NOT NULL,
  -- Scrubbed and truncated by the app (lib/telemetry/scrub.ts).
  message TEXT NOT NULL DEFAULT '',
  digest TEXT,
  fingerprint TEXT NOT NULL,
  household_id UUID REFERENCES public.households(id) ON DELETE SET NULL,
  -- Whitelisted keys only: method, routeType, renderSource, status, topFrame.
  context JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_app_errors_created ON public.app_errors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_errors_fingerprint_created ON public.app_errors(fingerprint, created_at DESC);

-- RLS on with no policies: only the service role (which bypasses RLS) can use this table.
ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;

-- Deletes telemetry rows past their retention, from the tables that exist.
-- Called by the health-check endpoint (#248) and safe to run by hand.
-- Returns the number of rows deleted.
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
  RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_telemetry() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_telemetry() TO service_role;
