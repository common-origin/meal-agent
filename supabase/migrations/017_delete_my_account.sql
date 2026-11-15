-- Migration: Delete my account (issue #224)
--
-- Settings → Your data → Delete account calls delete_my_account(), which in
-- one transaction:
--   1. takes the user out of their household (_leave_household, migration
--      015): if they were its only member, the household and all its data
--      go; otherwise it stays with its other members, and passes to the
--      longest-standing one if they were the owner;
--   2. deletes their AI usage log, pending invites to their email, and their
--      signup_invites row;
--   3. deletes their auth.users row (sessions and identities cascade).
-- Rows that only point at them (household_invites.invited_by,
-- household_favorites.created_by) are set to NULL by their foreign keys.
--
-- Needs migration 015 (for _leave_household).

-- The function runs as whoever runs this migration, so that role must be
-- able to delete from auth.users. Say so now rather than when a user tries.
DO $$
BEGIN
  IF NOT has_table_privilege(current_user, 'auth.users', 'DELETE') THEN
    RAISE EXCEPTION 'Role % cannot delete from auth.users, so delete_my_account() would fail. Run this migration as postgres in the Supabase SQL editor.', current_user;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS VOID AS $$
DECLARE
  me UUID := auth.uid();
  my_email TEXT;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'account:not_signed_in';
  END IF;
  SELECT lower(email) INTO my_email FROM auth.users WHERE id = me;

  PERFORM public._leave_household(me);
  DELETE FROM public.ai_usage WHERE user_id = me;
  IF my_email IS NOT NULL THEN
    DELETE FROM public.household_invites WHERE email = my_email AND accepted_at IS NULL;
    DELETE FROM public.signup_invites WHERE email = my_email;
  END IF;
  DELETE FROM auth.users WHERE id = me;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
