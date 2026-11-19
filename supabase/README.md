# Database Setup Instructions

## Execute SQL Migrations in Supabase

1. **Go to Supabase SQL Editor:**
   - Open https://supabase.com/dashboard/project/migfbyyftwgidbkwwyst/sql
   - Or navigate to: Project → SQL Editor

2. **Run Schema Migration (Step 1):**
   - Click "New Query"
   - Copy entire contents of `supabase/migrations/001_initial_schema.sql`
   - Paste into SQL Editor
   - Click "Run" or press Cmd+Enter
   - Verify success: Should see "Success. No rows returned"

3. **Run RLS Policies (Step 2):**
   - Click "New Query"
   - Copy entire contents of `supabase/migrations/002_rls_policies.sql`
   - Paste into SQL Editor
   - Click "Run" or press Cmd+Enter
   - Verify success: Should see "Success. No rows returned"

4. **Run Recipe ID Type Migration (Step 3):**
   - Click "New Query"
   - Copy entire contents of `supabase/migrations/003_alter_recipes_id_to_text.sql`
   - Paste into SQL Editor
   - Click "Run" or press Cmd+Enter
   - Verify success: Should see "Success. No rows returned"
   - This changes `recipes.id` from UUID to TEXT, so it can hold semantic IDs like `"ai-recipe-name"` alongside real UUIDs

5. **Run Full Settings JSONB Migration (Step 4):**
   - Click "New Query"
   - Copy entire contents of `supabase/migrations/004_add_full_settings_jsonb.sql`
   - Paste into SQL Editor
   - Click "Run" or press Cmd+Enter
   - Verify success: Should see "Success. No rows returned"
   - This adds a `full_settings` JSONB column for flexible settings storage

6. **Run Nutrition Column Migration (Step 5):**
   - Click "New Query"
   - Copy entire contents of `supabase/migrations/005_add_nutrition_column.sql`
   - Paste into SQL Editor
   - Click "Run" or press Cmd+Enter
   - Verify success: Should see "Success. No rows returned"
   - This adds a `nutrition` JSONB column to `recipes` for per-serving nutrition info

7. **Run ICS Token Migration (Step 6):**
   - Click "New Query"
   - Copy entire contents of `supabase/migrations/006_add_ics_token.sql`
   - Paste into SQL Editor
   - Click "Run" or press Cmd+Enter
   - Verify success: Should see "Success. No rows returned"
   - This adds an `ics_token` column to `households`, needed for the Settings page's "Calendar Sync" link and the `/api/plan/ics/[token]` feed route

8. **Run Recipe History Migration (Step 7):**
   - Click "New Query"
   - Copy entire contents of `supabase/migrations/007_add_recipe_history.sql`
   - Paste into SQL Editor
   - Click "Run" or press Cmd+Enter
   - Verify success: Should see "Success. No rows returned"
   - This adds a `recipe_history` table so recipe-repeat variety enforcement syncs across an authenticated household's devices, instead of resetting per device

9. **Run Pin Function search_path Migration (Step 8):**
   - Click "New Query"
   - Copy entire contents of `supabase/migrations/008_pin_function_search_paths.sql`
   - Paste into SQL Editor
   - Click "Run" or press Cmd+Enter
   - Verify success: Should see "Success. No rows returned"
   - This re-declares `handle_new_user()` and `get_user_household_id()` with a pinned `search_path`, closing the "Function Search Path Mutable" hardening gap on both SECURITY DEFINER functions

10. **Run Recipe Cuisine Migration (Step 9):**
   - Click "New Query"
   - Copy entire contents of `supabase/migrations/009_add_recipe_cuisine.sql`
   - Paste into SQL Editor
   - Click "Run" or press Cmd+Enter
   - Verify success: Should see "Success. No rows returned"
   - This adds a nullable `cuisine` column to `recipes` (#84). Run it **before** deploying code that saves recipes with a cuisine; saves fail if the column is missing

11. **Run AI Usage Migration (Step 10):**
   - Click "New Query"
   - Copy entire contents of `supabase/migrations/010_add_ai_usage.sql`
   - Paste into SQL Editor
   - Click "Run" or press Cmd+Enter
   - Verify success: Should see "Success. No rows returned"
   - This adds the `ai_usage` table: one row per AI call (tokens, estimated cost, latency, outcome), used for the per-user daily AI cap. It doesn't depend on `009`; the two can run in either order. Since #215 the AI limits fail closed, so AI features need this table (and `014`)

12. **Run Coles Extension Migration (Step 11):**
   - Click "New Query"
   - Copy entire contents of `supabase/migrations/011_coles_extension.sql`
   - Paste into SQL Editor
   - Click "Run" or press Cmd+Enter
   - Verify success: Should see "Success. No rows returned"
   - This adds `households.extension_token` and the `household_products` table for the Coles side-panel extension (#184). Until it's run, the extension's token can't be loaded in Settings

13. **Run Coles Order History Migration (Step 12):**
   - Click "New Query"
   - Copy entire contents of `supabase/migrations/012_coles_purchase_history.sql`
   - Paste into SQL Editor
   - Click "Run" or press Cmd+Enter
   - Verify success: Should see "Success. No rows returned"
   - This adds the `purchase_history` table and `household_products.source` for importing Coles order history (#185). Run it after `011`. Until it's run, the extension can't import past orders, and remembering a product with Find fails

14. **Run Invite-Only Signup Migration (Step 13):**
   - Click "New Query"
   - Copy entire contents of `supabase/migrations/013_invite_only_signup.sql`
   - Paste into SQL Editor
   - Click "Run" or press Cmd+Enter
   - Verify success: Should see "Success. No rows returned"
   - This adds the `signup_invites` table and a trigger that refuses a signup from any email not in it. Everyone with an account when it runs is added, so nobody is locked out. To invite someone: `INSERT INTO public.signup_invites (email, note) VALUES ('name@example.com', 'Sam');` (lower case). Add the row before using the dashboard's "Invite user" too, which is refused for an email that isn't in the table

15. **Run AI Spend Ceiling Migration (Step 14):**
   - Click "New Query"
   - Copy entire contents of `supabase/migrations/014_ai_spend_since.sql`
   - Paste into SQL Editor
   - Click "Run" or press Cmd+Enter
   - Verify success: Should see "Success. No rows returned"
   - This adds `ai_spend_since()`, the day's AI spend across all users, for the daily spend ceiling (#215). **Run it before deploying #215**: the app refuses AI calls while it can't read usage

16. **Run Household Invites Migration (Step 15):**
   - Click "New Query"
   - Copy entire contents of `supabase/migrations/015_household_invites.sql`
   - Paste into SQL Editor
   - Click "Run" or press Cmd+Enter
   - Verify success: Should see "Success. No rows returned"
   - This adds `household_invites` and the functions behind Settings → Household members and `/join/<token>` (#217), makes one household per user a rule, and limits updating a household (and its tokens) to its owner. If it fails with a duplicate key, someone is in two households: the comment at the top of the file shows how to find them

17. **Run Household Favourites Migration (Step 16):**
   - Click "New Query"
   - Copy entire contents of `supabase/migrations/016_household_favorites.sql`
   - Paste into SQL Editor
   - Click "Run" or press Cmd+Enter
   - Verify success: Should see "Success. No rows returned"
   - This adds `household_favorites`, so favourites follow a household across devices and members (#222). Until it's run, favourites keep working on each device, but don't sync

18. **Run Delete-My-Account Migration (Step 17):**
   - Click "New Query"
   - Copy entire contents of `supabase/migrations/017_delete_my_account.sql`
   - Paste into SQL Editor
   - Click "Run" or press Cmd+Enter
   - Verify success: Should see "Success. No rows returned"
   - This adds `delete_my_account()`, behind Settings → Your data → Delete account (#224). Run it after `015`. Until it's run, deleting an account says it couldn't be deleted

19. **Run Coles Quota Migration (Step 18):**
   - Click "New Query"
   - Copy entire contents of `supabase/migrations/018_coles_quota.sql`
   - Paste into SQL Editor
   - Click "Run" or press Cmd+Enter
   - Verify success: Should see "Success. No rows returned"
   - This adds `claim_api_call()` and `api_calls_since()`, which count every household's Coles lookups against the shared RapidAPI quota (#227). Until it's run, Coles lookups are refused and prices fall back to estimates

20. **Run App Errors Migration (Step 19):**
   - Click "New Query"
   - Copy entire contents of `supabase/migrations/019_app_errors.sql`
   - Paste into SQL Editor
   - Click "Run" or press Cmd+Enter
   - Verify success: Should see "Success. No rows returned"
   - This adds `app_errors` and `purge_telemetry()` for the admin dashboard (#244, #245). Until it's run, errors are only logged to Vercel and each failed save warns; nothing else is affected

21. **Run Product Events Migration (Step 20):**
   - Click "New Query"
   - Copy entire contents of `supabase/migrations/020_product_events.sql`
   - Paste into SQL Editor
   - Click "Run" or press Cmd+Enter
   - Verify success: Should see "Success. No rows returned"
   - This adds `product_events` and replaces `purge_telemetry()` for the admin dashboard (#244, #247). Run it after `019`. Until it's run, events are dropped with a logged warning; nothing else is affected

22. **Run Health Checks Migration (Step 21):**
   - Click "New Query"
   - Copy entire contents of `supabase/migrations/021_health_checks.sql`
   - Paste into SQL Editor
   - Click "Run" or press Cmd+Enter
   - Verify success: Should see "Success. No rows returned"
   - This adds `health_checks` and replaces `purge_telemetry()` for the admin dashboard (#244, #248). Run it after `019` (and `020`: the function it replaces covers every telemetry table that exists). Also set `HEALTH_CHECK_SECRET` (a long random string) in Vercel production and in GitHub → Settings → Secrets → Actions, and the `HEALTH_CHECK_URL` repo variable (Settings → Variables) to the production origin. Until then, no uptime rows are recorded and nothing else is affected

23. **Run Admin Reporting Migration (Step 22):**
   - Click "New Query"
   - Copy entire contents of `supabase/migrations/022_admin_reporting.sql`
   - Paste into SQL Editor
   - Click "Run" or press Cmd+Enter
   - Verify success: Should see "Success. No rows returned"
   - This adds the six reporting functions behind the `/admin` overview (#244, #249). Run it after `019`-`021`. Until it's run, `/admin` still opens but its sections say they couldn't load

24. **Verify Tables Created:**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   ```
   
   Should see:
   - ai_usage
   - api_usage
   - app_errors
   - family_settings
   - health_checks
   - household_members
   - household_products
   - households
   - meal_plans
   - pantry_preferences
   - product_events
   - purchase_history
   - recipe_history
   - recipes
   - shopping_lists
   - signup_invites

25. **Verify RLS Enabled:**
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public';
   ```
   
   All tables should have `rowsecurity = true`

## What Was Created

### Tables:
- **households** - Family units that share meal plans
- **household_members** - Links users to households with owner/member roles; one household per user (015)
- **household_invites** - An owner's invite to one email, accepted at `/join/<token>` or at signup (015)
- **household_favorites** - The household's favourite recipes, shared across devices and members (016)
- **family_settings** - Preferences for meal generation (servings, cuisines, etc.)
- **recipes** - AI-generated or user-added recipes
- **meal_plans** - Weekly meal schedules (JSONB format)
- **shopping_lists** - Aggregated shopping items per week
- **pantry_preferences** - Items always in pantry (exclude from shopping)
- **api_usage** - Original AI cost table from 001; nothing writes to it (superseded by `ai_usage`)
- **ai_usage** - One row per AI call: task, model, tokens, estimated cost, latency, outcome; backs the per-user daily AI cap (#85) and the daily spend ceiling (014, #215)
- **recipe_history** - Recipes used per composed week, for cross-device repeat-avoidance
- **household_products** - The Coles product a household buys for each ingredient, for the Coles extension (#184)
- **purchase_history** - Past Coles online order lines with the price paid, kept 12 months (#185)
- **signup_invites** - Emails allowed to create an account; any other signup is refused (013)

### Automatic Behaviors:
- **New User Signup** → Refused unless the email is in `signup_invites` (013) or has a pending household invite (015). With a pending household invite, the user joins that household as a member; otherwise a household is created with the user as owner, plus default settings
- **Updated Timestamps** → Auto-updated on every row modification
- **Household ID Helper** → Function to get current user's household ID

### Security (RLS):
- ✅ Users only see data from their own household
- ✅ All household members have equal permissions (collaborative)
- ✅ Owner role can invite/remove members
- ✅ Complete data isolation between accounts

## Deleting an account on request

Users delete their own account in Settings → Your data (`delete_my_account()`, migration 017, #224), which also removes their household if they're its only member. The SQL below is for when someone can't sign in and emails instead.

The privacy policy (`/privacy`) promises to do it within 30 days of an emailed request. Deleting the user
under Authentication → Users is **not enough**: it removes their membership,
but `households` has no link to `auth.users`, so the household and all its
data stay. In the SQL editor, with their email:

```sql
-- 1. Find their household (check no one else is a member before deleting it).
SELECT hm.household_id, count(*) OVER (PARTITION BY hm.household_id) AS members
FROM public.household_members hm
JOIN auth.users u ON u.id = hm.user_id
WHERE u.email = 'name@example.com';

-- 2. Delete the household: settings, recipes, plans, shopping lists, pantry,
--    Coles products and orders all cascade from it.
DELETE FROM public.households WHERE id = '<household_id>';

-- 3. Their AI usage log (no content, but tied to them) and their invite.
DELETE FROM public.ai_usage WHERE user_id = (SELECT id FROM auth.users WHERE email = 'name@example.com');
DELETE FROM public.signup_invites WHERE email = 'name@example.com';
```

Then delete the user under Authentication → Users. If the household has other
members, skip step 2 and only delete this user.

## Next Steps

After running these migrations:
1. ✅ Add Supabase credentials to Vercel environment variables
2. ✅ Test signup flow (should auto-create household)
3. ✅ Build login/signup pages
4. ✅ Migrate localStorage data to PostgreSQL
