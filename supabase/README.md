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

8. **Verify Tables Created:**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   ```
   
   Should see:
   - api_usage
   - family_settings
   - household_members
   - households
   - meal_plans
   - pantry_preferences
   - recipes
   - shopping_lists

9. **Verify RLS Enabled:**
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
- **api_usage** - Track AI API costs per household

### Automatic Behaviors:
- **New User Signup** → Auto-creates household, adds user as owner, creates default settings
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
