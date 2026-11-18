-- Migration: health_checks, our own uptime history (issue #248, initiative #244)
--
-- A scheduled GitHub Actions workflow (.github/workflows/uptime.yml) calls
-- POST /api/health/record every 15 minutes; the endpoint runs the dependency
-- checks and stores one row here. The admin dashboard computes uptime from
-- these rows on read. `checks` holds each dependency's result (ok, latency, a
-- short static detail, a few counts), never secrets or personal info.
--
-- Run this before deploying #248. Until it exists the endpoints still answer
-- (record reports `recorded: false`, GET /api/health reports `unknown`).
--
-- Replaces purge_telemetry() (from 020) so it also trims health_checks, kept
-- 90 days. app_errors stays 90 days, product_events 400 days.

CREATE TABLE IF NOT EXISTS public.health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Short git SHA of the deployment that ran the checks ('dev' locally).
  release TEXT NOT NULL,
  ok BOOLEAN NOT NULL,
  checks JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_latency_ms INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_health_checks_created ON public.health_checks(created_at DESC);

-- RLS on with no policies: only the service role (which bypasses RLS) can use this table.
ALTER TABLE public.health_checks ENABLE ROW LEVEL SECURITY;

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
  IF to_regclass('public.health_checks') IS NOT NULL THEN
    DELETE FROM public.health_checks WHERE created_at < now() - interval '90 days';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted := v_deleted + v_count;
  END IF;
  RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_telemetry() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_telemetry() TO service_role;
