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

4. **Run Full Settings JSONB Migration (Step 3):**
   - Click "New Query"
   - Copy entire contents of `supabase/migrations/004_add_full_settings_jsonb.sql`
   - Paste into SQL Editor
   - Click "Run" or press Cmd+Enter
   - Verify success: Should see "Success. No rows returned"
   - This adds a `full_settings` JSONB column for flexible settings storage

5. **Verify Tables Created:**
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

6. **Verify RLS Enabled:**
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
