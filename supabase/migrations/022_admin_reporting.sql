-- Migration: reporting functions for the /admin overview (issue #249, initiative #244)
--
-- Supabase returns at most 1,000 rows per request, so the dashboard reads its
-- aggregates through these functions, each of which returns ONE jsonb value
-- (never a long row set that could be cut off). They are plain functions with
-- search_path pinned, and only the service role may run them (the page calls
-- them after checking ADMIN_EMAILS). No names or emails are returned: a
-- household is its id (the page shows only the first 8 characters).
--
-- Run this after 019-021. A function that reads a telemetry table (app_errors,
-- product_events) that doesn't exist yet leaves that part empty, or fails only
-- its own dashboard section, rather than the whole page.
--
--   admin_ai_summary(since, household, billing_codes)  AI calls per task and model, daily trend, latest failures
--   admin_error_groups(since, household)               errors grouped by fingerprint
--   admin_weekly_cycle(weeks, household)               the plan > confirm > shop funnel per planned week, and usage
--   admin_household_summary(since)                     one entry per household
--   admin_db_stats()                                   rows, size and dead tuples per table
--   admin_schema_check()                               whether each migration from 009 on has been run
--
-- Weeks are ISO weeks (Monday start) in the household's own time zone
-- (family_settings.full_settings -> location -> timeZone) when it is a zone
-- Postgres knows, otherwise Australia/Sydney (lib/timeZones.ts).

-- ---------------------------------------------------------------------------
-- AI agent
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_ai_summary(
  p_since TIMESTAMPTZ,
  p_household UUID DEFAULT NULL,
  p_billing_codes TEXT[] DEFAULT ARRAY['http_402']
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_by_task JSONB;
  v_daily JSONB;
  v_failures JSONB;
  v_billing INTEGER;
BEGIN
  WITH u AS (
    SELECT * FROM public.ai_usage
    WHERE created_at >= p_since AND (p_household IS NULL OR household_id = p_household)
  ),
  per AS (
    SELECT task, model,
           count(*)::int AS calls,
           count(*) FILTER (WHERE status = 'ok')::int AS ok_calls,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms) AS p50,
           percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95,
           avg(input_tokens) AS avg_in,
           avg(output_tokens) AS avg_out,
           COALESCE(sum(cost_usd), 0) AS cost
    FROM u GROUP BY task, model
  ),
  st AS (
    SELECT task, model, jsonb_object_agg(status, n) AS statuses
    FROM (SELECT task, model, status, count(*)::int AS n FROM u GROUP BY task, model, status) s
    GROUP BY task, model
  ),
  errs AS (
    SELECT task, model, jsonb_agg(jsonb_build_object('code', error_code, 'count', n) ORDER BY n DESC, error_code) AS top_errors
    FROM (
      SELECT task, model, error_code, n,
             row_number() OVER (PARTITION BY task, model ORDER BY n DESC, error_code) AS rn
      FROM (SELECT task, model, error_code, count(*)::int AS n FROM u WHERE status <> 'ok' AND error_code IS NOT NULL GROUP BY task, model, error_code) e
    ) ranked
    WHERE rn <= 5
    GROUP BY task, model
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'task', per.task, 'model', per.model, 'calls', per.calls, 'ok_calls', per.ok_calls,
           'p50_ms', round(per.p50)::int, 'p95_ms', round(per.p95)::int,
           'avg_input_tokens', round(per.avg_in), 'avg_output_tokens', round(per.avg_out),
           'cost_usd', per.cost,
           'statuses', COALESCE(st.statuses, '{}'::jsonb),
           'top_errors', COALESCE(errs.top_errors, '[]'::jsonb)
         ) ORDER BY per.calls DESC, per.task, per.model), '[]'::jsonb)
  INTO v_by_task
  FROM per
  LEFT JOIN st ON st.task = per.task AND st.model = per.model
  LEFT JOIN errs ON errs.task = per.task AND errs.model = per.model;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'day', day, 'calls', calls, 'ok_calls', ok_calls, 'cost_usd', cost
         ) ORDER BY day), '[]'::jsonb)
  INTO v_daily
  FROM (
    SELECT (created_at AT TIME ZONE 'UTC')::date AS day,
           count(*)::int AS calls,
           count(*) FILTER (WHERE status = 'ok')::int AS ok_calls,
           COALESCE(sum(cost_usd), 0) AS cost
    FROM public.ai_usage
    WHERE created_at >= p_since AND (p_household IS NULL OR household_id = p_household)
    GROUP BY 1
  ) d;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'created_at', created_at, 'task', task, 'model', model, 'status', status,
           'error_code', error_code, 'latency_ms', latency_ms
         ) ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_failures
  FROM (
    SELECT created_at, task, model, status, error_code, latency_ms
    FROM public.ai_usage
    WHERE created_at >= p_since AND status <> 'ok' AND (p_household IS NULL OR household_id = p_household)
    ORDER BY created_at DESC
    LIMIT 20
  ) f;

  SELECT count(*)::int INTO v_billing
  FROM public.ai_usage
  WHERE created_at >= p_since AND status = 'error' AND error_code = ANY (p_billing_codes)
    AND (p_household IS NULL OR household_id = p_household);

  RETURN jsonb_build_object('by_task', v_by_task, 'daily', v_daily, 'failures', v_failures, 'billing_errors', v_billing);
END;
$$;

-- ---------------------------------------------------------------------------
-- Errors
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_error_groups(
  p_since TIMESTAMPTZ,
  p_household UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH win AS (
    SELECT * FROM public.app_errors
    WHERE created_at >= p_since AND (p_household IS NULL OR household_id = p_household)
  ),
  grp AS (
    SELECT fingerprint,
           count(*)::int AS cnt,
           count(*) FILTER (WHERE created_at >= now() - interval '24 hours')::int AS cnt_24h,
           count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS cnt_7d,
           max(created_at) AS last_seen,
           array_agg(DISTINCT release ORDER BY release) AS releases,
           count(DISTINCT household_id)::int AS households
    FROM win GROUP BY fingerprint
  ),
  rep AS (
    SELECT DISTINCT ON (fingerprint) fingerprint, label, kind, message, route, source
    FROM win ORDER BY fingerprint, created_at DESC
  ),
  ranked AS (
    SELECT grp.*, rep.label, rep.kind, rep.message, rep.route, rep.source,
           -- First ever seen, not first in the window: a fingerprint last seen a month ago isn't "new" today.
           (SELECT min(e.created_at) FROM public.app_errors e WHERE e.fingerprint = grp.fingerprint) AS first_seen
    FROM grp JOIN rep USING (fingerprint)
    ORDER BY grp.last_seen DESC
    LIMIT 100
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'fingerprint', r.fingerprint, 'label', r.label, 'kind', r.kind, 'message', r.message,
           'route', r.route, 'source', r.source, 'count', r.cnt, 'count_24h', r.cnt_24h, 'count_7d', r.cnt_7d,
           'first_seen', r.first_seen, 'last_seen', r.last_seen, 'releases', to_jsonb(r.releases),
           'households', r.households,
           'latest', (
             SELECT COALESCE(jsonb_agg(jsonb_build_object(
                      'created_at', o.created_at, 'release', o.release, 'source', o.source,
                      'digest', o.digest, 'context', o.context
                    ) ORDER BY o.created_at DESC), '[]'::jsonb)
             FROM (SELECT * FROM win w WHERE w.fingerprint = r.fingerprint ORDER BY w.created_at DESC LIMIT 10) o
           )
         ) ORDER BY r.last_seen DESC), '[]'::jsonb)
  INTO v_result
  FROM ranked r;

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- Weekly cycle and usage
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_weekly_cycle(
  p_weeks INTEGER DEFAULT 8,
  p_household UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_this_monday DATE := date_trunc('week', now() AT TIME ZONE 'Australia/Sydney')::date;
  v_end DATE;
  v_first DATE;
  v_weeks JSONB;
  v_cuisines JSONB;
  v_households INTEGER;
  v_events JSONB := jsonb_build_object('available', false, 'ratings', jsonb_build_object('count', 0, 'avg', NULL, 'by_star', '{}'::jsonb), 'counts', '{}'::jsonb, 'swaps', '{}'::jsonb, 'edits', '{}'::jsonb, 'funnel', '[]'::jsonb);
BEGIN
  -- The newest week shown: this week, or next week when a plan for it exists.
  SELECT GREATEST(v_this_monday, COALESCE(max(week_start) FILTER (WHERE week_start <= v_this_monday + 7), v_this_monday))
  INTO v_end
  FROM public.meal_plans;
  v_first := v_end - 7 * (GREATEST(p_weeks, 1) - 1);

  SELECT count(*)::int INTO v_households FROM public.households WHERE p_household IS NULL OR id = p_household;

  -- Events part, only when product_events exists (migration 020).
  IF to_regclass('public.product_events') IS NOT NULL THEN
    EXECUTE $q$
      WITH tz AS (
        SELECT h.id,
               COALESCE((SELECT z.name FROM pg_timezone_names z WHERE z.name = fs.full_settings -> 'location' ->> 'timeZone' LIMIT 1), 'Australia/Sydney') AS tz
        FROM public.households h
        LEFT JOIN public.family_settings fs ON fs.household_id = h.id
      ),
      ev AS (
        SELECT e.type, e.props, e.household_id,
               date_trunc('week', e.created_at AT TIME ZONE COALESCE(tz.tz, 'Australia/Sydney'))::date AS event_week
        FROM public.product_events e
        LEFT JOIN tz ON tz.id = e.household_id
        -- Funnel events for a planned week can be sent weeks before that week starts.
        WHERE e.created_at >= ($1::date)::timestamptz - interval '28 days'
          AND ($3::uuid IS NULL OR e.household_id = $3::uuid)
      ),
      inwin AS (SELECT * FROM ev WHERE event_week >= $1 AND event_week <= $2)
      SELECT jsonb_build_object(
        'available', true,
        'funnel', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
                   'week_start', week_start, 'type', type, 'households', households) ORDER BY week_start, type)
          FROM (
            SELECT props ->> 'weekStart' AS week_start, type, count(DISTINCT household_id)::int AS households
            FROM ev
            WHERE type IN ('plan_confirmed', 'shopping_list_built', 'coles_list_sent', 'shopping_completed')
              AND props ->> 'weekStart' ~ '^\d{4}-\d{2}-\d{2}$'
              AND (props ->> 'weekStart')::date BETWEEN $1 AND $2
            GROUP BY 1, 2
          ) f), '[]'::jsonb),
        'swaps', COALESCE((SELECT jsonb_object_agg(event_week::text, n) FROM (
            SELECT event_week, count(*)::int AS n FROM inwin WHERE type = 'swap' AND props ->> 'kind' IN ('swap', 'delete') GROUP BY 1) s), '{}'::jsonb),
        'edits', COALESCE((SELECT jsonb_object_agg(event_week::text, n) FROM (
            SELECT event_week, count(*)::int AS n FROM inwin WHERE type = 'plan_edit_accepted' GROUP BY 1) s), '{}'::jsonb),
        'ratings', jsonb_build_object(
          'count', (SELECT count(*)::int FROM inwin WHERE type = 'recipe_rated'),
          'avg', (SELECT round(avg((props ->> 'stars')::numeric), 2) FROM inwin WHERE type = 'recipe_rated'),
          'by_star', COALESCE((SELECT jsonb_object_agg(stars, n) FROM (
              SELECT props ->> 'stars' AS stars, count(*)::int AS n FROM inwin WHERE type = 'recipe_rated' GROUP BY 1) r), '{}'::jsonb)),
        'counts', COALESCE((SELECT jsonb_object_agg(type, n) FROM (SELECT type, count(*)::int AS n FROM inwin GROUP BY type) c), '{}'::jsonb)
      )
    $q$ INTO v_events USING v_first, v_end, p_household;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'week_start', w.week_start,
           'composed', (SELECT count(DISTINCT mp.household_id)::int FROM public.meal_plans mp
                        WHERE mp.week_start = w.week_start AND (p_household IS NULL OR mp.household_id = p_household)),
           'recipes_ai', (SELECT count(*)::int FROM public.recipes r
                          WHERE r.source_domain = 'ai-generated' AND (p_household IS NULL OR r.household_id = p_household)
                            AND date_trunc('week', r.created_at AT TIME ZONE 'Australia/Sydney')::date = w.week_start),
           'recipes_imported', (SELECT count(*)::int FROM public.recipes r
                                WHERE r.source_domain IS NOT NULL AND r.source_domain NOT IN ('ai-generated', 'user-added')
                                  AND (p_household IS NULL OR r.household_id = p_household)
                                  AND date_trunc('week', r.created_at AT TIME ZONE 'Australia/Sydney')::date = w.week_start),
           'recipes_user_added', (SELECT count(*)::int FROM public.recipes r
                                  WHERE (r.source_domain IS NULL OR r.source_domain = 'user-added')
                                    AND (p_household IS NULL OR r.household_id = p_household)
                                    AND date_trunc('week', r.created_at AT TIME ZONE 'Australia/Sydney')::date = w.week_start)
         ) ORDER BY w.week_start DESC), '[]'::jsonb)
  INTO v_weeks
  FROM (SELECT generate_series(v_first, v_end, interval '7 days')::date AS week_start) w;

  -- Distinct cuisines cooked per household (recipe_history joined to recipes.cuisine, migration 009), over the same weeks.
  SELECT jsonb_build_object(
           'households', count(*)::int,
           'avg', round(avg(n), 2),
           'max', max(n)
         )
  INTO v_cuisines
  FROM (
    SELECT rh.household_id, count(DISTINCT r.cuisine)::int AS n
    FROM public.recipe_history rh
    JOIN public.recipes r ON r.id = rh.recipe_id AND r.household_id = rh.household_id
    WHERE r.cuisine IS NOT NULL AND rh.week_start BETWEEN v_first AND v_end
      AND (p_household IS NULL OR rh.household_id = p_household)
    GROUP BY rh.household_id
  ) c;

  RETURN jsonb_build_object(
    'first_week', v_first, 'last_week', v_end, 'households_total', v_households,
    'weeks', v_weeks, 'cuisines', v_cuisines, 'events', v_events
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Households
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_household_summary(p_since TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_has_events BOOLEAN := to_regclass('public.product_events') IS NOT NULL;
  v_has_errors BOOLEAN := to_regclass('public.app_errors') IS NOT NULL;
  v_events_active JSONB := '{}'::jsonb;
  v_errors JSONB := '{}'::jsonb;
  v_result JSONB;
BEGIN
  IF v_has_events THEN
    EXECUTE $q$SELECT COALESCE(jsonb_object_agg(household_id::text, last_at), '{}'::jsonb)
                FROM (SELECT household_id, max(created_at) AS last_at FROM public.product_events WHERE household_id IS NOT NULL GROUP BY 1) e$q$
      INTO v_events_active;
  END IF;
  IF v_has_errors THEN
    EXECUTE $q$SELECT COALESCE(jsonb_object_agg(household_id::text, n), '{}'::jsonb)
                FROM (SELECT household_id, count(*)::int AS n FROM public.app_errors WHERE household_id IS NOT NULL AND created_at >= $1 GROUP BY 1) e$q$
      INTO v_errors USING p_since;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb ORDER BY x.last_active DESC NULLS LAST, x.id), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT h.id,
           (SELECT count(*)::int FROM public.household_members m WHERE m.household_id = h.id) AS members,
           (SELECT count(*)::int FROM public.household_invites i
              WHERE i.household_id = h.id AND i.accepted_at IS NULL AND i.expires_at > now()) AS pending_invites,
           GREATEST(
             (SELECT max(mp.updated_at) FROM public.meal_plans mp WHERE mp.household_id = h.id),
             (SELECT max(a.created_at) FROM public.ai_usage a WHERE a.household_id = h.id),
             NULLIF(v_events_active ->> h.id::text, '')::timestamptz
           ) AS last_active,
           EXISTS (
             SELECT 1 FROM public.meal_plans mp
             WHERE mp.household_id = h.id
               AND mp.week_start = date_trunc('week', now() AT TIME ZONE COALESCE(
                     (SELECT z.name FROM pg_timezone_names z WHERE z.name = fs.full_settings -> 'location' ->> 'timeZone' LIMIT 1),
                     'Australia/Sydney'))::date
           ) AS has_plan_this_week,
           (fs.full_settings IS NOT NULL) AS settings_complete,
           (SELECT count(*)::int FROM public.ai_usage a WHERE a.household_id = h.id AND a.created_at >= p_since) AS ai_calls,
           COALESCE((SELECT sum(a.cost_usd) FROM public.ai_usage a WHERE a.household_id = h.id AND a.created_at >= p_since), 0) AS ai_cost_usd,
           COALESCE((v_errors ->> h.id::text)::int, 0) AS errors,
           -- The last three generation calls all failed: this household is stuck.
           (SELECT count(*) = 3 AND bool_and(g.status <> 'ok') FROM (
              SELECT a.status FROM public.ai_usage a
              WHERE a.household_id = h.id AND a.task = 'generation'
              ORDER BY a.created_at DESC LIMIT 3) g) AS last3_generation_failed
    FROM public.households h
    LEFT JOIN public.family_settings fs ON fs.household_id = h.id
  ) x;

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- Database
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_db_stats()
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'table', relname,
           'rows', n_live_tup,
           'dead_rows', n_dead_tup,
           'dead_ratio', CASE WHEN n_live_tup + n_dead_tup = 0 THEN 0 ELSE round(n_dead_tup::numeric / (n_live_tup + n_dead_tup), 4) END,
           'size_bytes', pg_total_relation_size(relid)
         ) ORDER BY pg_total_relation_size(relid) DESC, relname), '[]'::jsonb)
  FROM pg_stat_user_tables
  WHERE schemaname = 'public';
$$;

-- A signature for each migration from 009 on: a table, a function or a column
-- that migration created. Earlier migrations are assumed applied.
CREATE OR REPLACE FUNCTION public.admin_schema_check()
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  WITH checks(migration, name, applied) AS (
    VALUES
      ('009', 'recipes.cuisine', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'recipes' AND column_name = 'cuisine')),
      ('010', 'ai_usage', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_usage')),
      ('011', 'households.extension_token', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'households' AND column_name = 'extension_token')),
      ('012', 'purchase_history', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchase_history')),
      ('013', 'signup_invites', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'signup_invites')),
      ('014', 'ai_spend_since()', EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'ai_spend_since')),
      ('015', 'household_invites', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'household_invites')),
      ('016', 'household_favorites', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'household_favorites')),
      ('017', 'delete_my_account()', EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'delete_my_account')),
      ('018', 'claim_api_call()', EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'claim_api_call')),
      ('019', 'app_errors', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_errors')),
      ('020', 'product_events', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_events')),
      ('021', 'health_checks', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'health_checks')),
      ('022', 'admin_reporting', EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'admin_weekly_cycle'))
  )
  SELECT jsonb_agg(jsonb_build_object('migration', migration, 'name', name, 'applied', applied) ORDER BY migration) FROM checks;
$$;

-- Only the server (service role) may run these; the page checks ADMIN_EMAILS first.
REVOKE EXECUTE ON FUNCTION public.admin_ai_summary(TIMESTAMPTZ, UUID, TEXT[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_error_groups(TIMESTAMPTZ, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_weekly_cycle(INTEGER, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_household_summary(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_db_stats() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_schema_check() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ai_summary(TIMESTAMPTZ, UUID, TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_error_groups(TIMESTAMPTZ, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_weekly_cycle(INTEGER, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_household_summary(TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_db_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_schema_check() TO service_role;
