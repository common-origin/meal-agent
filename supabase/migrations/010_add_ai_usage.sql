-- Migration: AI usage log (issue #85)
-- One row per AI call (a logical call, including any retries): which task
-- and model ran, token counts, estimated cost, latency and outcome. Written
-- by the API routes after the response is sent (lib/ai/usage.ts), and read
-- to enforce the per-user daily AI cap and to see what the AI costs.
--
-- The app tolerates this table being missing: logging failures are only
-- warned about, and the daily cap fails open. 009 is reserved for #84's
-- recipes.cuisine column; the two migrations are independent.

CREATE TABLE IF NOT EXISTS public.ai_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  -- Filled in by the database from the caller's session, so the app doesn't
  -- need a separate lookup (and multi-household users still get one).
  household_id UUID NULL DEFAULT public.get_user_household_id(),
  task TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INT,
  output_tokens INT,
  thinking_tokens INT,
  cost_usd NUMERIC(10,6),
  latency_ms INT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ok', 'error', 'timeout', 'blocked', 'invalid_output', 'rate_limited')),
  error_code TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The daily cap counts a user's rows since UTC midnight.
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_created ON public.ai_usage(user_id, created_at DESC);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- household_id is checked too, so a user can't tag a row with another
-- household and have it show up in that household's view.
CREATE POLICY "Users can log their own AI usage"
  ON public.ai_usage FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (household_id IS NULL OR household_id = public.get_user_household_id())
  );

CREATE POLICY "Users can view their own or their household's AI usage"
  ON public.ai_usage FOR SELECT
  USING (user_id = auth.uid() OR household_id = public.get_user_household_id());
