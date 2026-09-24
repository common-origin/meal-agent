-- Migration: Add ics_token column to households table
-- Backs the weekly meal plan ICS export (issue #3): a dedicated random
-- token, separate from households.id, used to authorize unauthenticated
-- polling of a household's calendar feed (e.g. by GAS-ICS-Sync). Using a
-- dedicated secret rather than households.id means the household's primary
-- key can still appear in ordinary app contexts (logs, other API responses)
-- without also granting calendar-feed access.

ALTER TABLE public.households
ADD COLUMN IF NOT EXISTS ics_token UUID NOT NULL DEFAULT uuid_generate_v4();

CREATE UNIQUE INDEX IF NOT EXISTS idx_households_ics_token ON public.households(ics_token);

COMMENT ON COLUMN public.households.ics_token IS 'Opaque secret token used to authorize the ICS calendar feed for this household (/api/plan/ics/[token]) without requiring an authenticated session. Existing RLS policies already scope SELECT/UPDATE on this table to a household''s own members, so a member can view or (via a future regenerate action) rotate their own household''s token through the normal client.';
