# Recipe ID Migration

## Issue
The recipes table was created with `id UUID` but our application uses TEXT-based IDs like:
- `"ai-quick-italian-chicken-veggie-skillet-with-creamy-polenta"` for AI-generated recipes
- `"jamie-oliver-recipe-name"` for library recipes

This caused migration failures with error: `invalid input syntax for type uuid`

## Solution
Changed `recipes.id` from `UUID` to `TEXT` to support both UUID and semantic string IDs.

## Steps to Apply

1. **Open Supabase SQL Editor**
   - Go to: https://supabase.com/dashboard/project/migfbyyftwgidbkwwyst/sql

2. **Run the migration**
   - Copy contents of `supabase/migrations/003_alter_recipes_id_to_text.sql`
   - Paste into SQL Editor
   - Click "Run"

3. **Regenerate TypeScript types**
   ```bash
   supabase gen types typescript --project-id migfbyyftwgidbkwwyst > apps/web/src/lib/supabase/database.types.ts
   ```

4. **Test migration again**
   - Reload the app
   - Try the migration again

## Note
This migration drops and recreates the recipes table, which is safe since:
- We're in development
- User recipes haven't been migrated yet (they're still in localStorage)
- No production data exists
