-- Migration: AI spend across all users (issue #215)
--
-- The daily AI spend ceiling (lib/ai/usage.ts) needs the total estimated
-- cost of every AI call since UTC midnight, across all users. RLS limits
-- each user to their own ai_usage rows, so the server reads the total
-- through this function with the service role. Nobody else can call it.
--
-- Run this before deploying #215: until it exists, the app can't read the
-- day's spend and refuses AI calls (it fails closed).

CREATE OR REPLACE FUNCTION public.ai_spend_since(since TIMESTAMPTZ)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  -- cost_usd is NULL for a model without known rates; those count as 0.
  SELECT COALESCE(SUM(cost_usd), 0) FROM public.ai_usage WHERE created_at >= since;
$$;

REVOKE ALL ON FUNCTION public.ai_spend_since(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_spend_since(TIMESTAMPTZ) TO service_role;

-- The existing index leads with user_id; this one serves the all-users sum.
CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON public.ai_usage(created_at);
