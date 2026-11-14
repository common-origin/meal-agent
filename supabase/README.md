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
   - This adds the `ai_usage` table: one row per AI call (tokens, estimated cost, latency, outcome), used for the per-user daily AI cap. It doesn't depend on `009`; the two can run in either order. The app tolerates the table being missing: usage just isn't recorded and the daily cap isn't enforced

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
   - This adds the `signup_invites` table and a trigger that refuses a signup from any email not in it. Everyone with an account when it runs is added, so nobody is locked out. To invite someone: `INSERT INTO public.signup_invites (email, note) VALUES ('name@example.com', 'Sam');` (lower case)

15. **Verify Tables Created:**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   ```
   
   Should see:
   - ai_usage
   - api_usage
   - family_settings
   - household_members
   - household_products
   - households
   - meal_plans
   - pantry_preferences
   - purchase_history
   - recipe_history
   - recipes
   - shopping_lists
   - signup_invites

16. **Verify RLS Enabled:**
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public';
   ```
   
   All tables should have `rowsecurity = true`

## What Was Created

### Tables:
- **households** - Family units that share meal plans
- **household_members** - Links users to households with owner/member roles
- **family_settings** - Preferences for meal generation (servings, cuisines, etc.)
- **recipes** - AI-generated or user-added recipes
- **meal_plans** - Weekly meal schedules (JSONB format)
- **shopping_lists** - Aggregated shopping items per week
- **pantry_preferences** - Items always in pantry (exclude from shopping)
- **api_usage** - Original AI cost table from 001; nothing writes to it (superseded by `ai_usage`)
- **ai_usage** - One row per AI call: task, model, tokens, estimated cost, latency, outcome; backs the daily AI cap (#85)
- **recipe_history** - Recipes used per composed week, for cross-device repeat-avoidance
- **household_products** - The Coles product a household buys for each ingredient, for the Coles extension (#184)
- **purchase_history** - Past Coles online order lines with the price paid, kept 12 months (#185)
- **signup_invites** - Emails allowed to create an account; any other signup is refused (013)

### Automatic Behaviors:
- **New User Signup** → Refused unless the email is in `signup_invites` (013); otherwise auto-creates household, adds user as owner, creates default settings
- **Updated Timestamps** → Auto-updated on every row modification
- **Household ID Helper** → Function to get current user's household ID

### Security (RLS):
- ✅ Users only see data from their own household
- ✅ All household members have equal permissions (collaborative)
- ✅ Owner role can invite/remove members
- ✅ Complete data isolation between accounts

## Next Steps

After running these migrations:
1. ✅ Add Supabase credentials to Vercel environment variables
2. ✅ Test signup flow (should auto-create household)
3. ✅ Build login/signup pages
4. ✅ Migrate localStorage data to PostgreSQL
