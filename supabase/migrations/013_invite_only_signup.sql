-- Migration: Invite-only signup
--
-- Anyone could create an account with Google or a magic link, and every new
-- account gets a household (handle_new_user). Now a new account is created
-- only for an email listed in public.signup_invites. Existing accounts are
-- unaffected: the check runs on INSERT into auth.users, which only happens
-- at signup.
--
-- To invite someone, run in the SQL editor:
--   INSERT INTO public.signup_invites (email, note) VALUES ('name@example.com', 'Sam');
-- Emails are stored lower case, and the check ignores case. Add the row
-- before using the Supabase dashboard's "Invite user" (or
-- auth.admin.inviteUserByEmail): those create the user too, so they're
-- refused for an email that isn't here yet.
--
-- A refused signup fails inside Supabase Auth, which reports it as
-- "Database error saving new user"; the app shows its own "not invited"
-- copy for that (lib/auth/authErrorMessages.ts).

CREATE TABLE IF NOT EXISTS public.signup_invites (
  email TEXT PRIMARY KEY CHECK (email = lower(email)),
  note TEXT,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS on and no policies: only the SQL editor (or the service role) can read
-- or change invites. The trigger below runs as its owner, so it can read them.
ALTER TABLE public.signup_invites ENABLE ROW LEVEL SECURITY;

-- Everyone who already has an account counts as invited, so the table is a
-- complete record of who may use the app.
INSERT INTO public.signup_invites (email, note)
SELECT lower(email), 'existing account'
FROM auth.users
WHERE email IS NOT NULL
ON CONFLICT (email) DO NOTHING;

CREATE OR REPLACE FUNCTION public.enforce_signup_invite()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.signup_invites WHERE email = lower(NEW.email)
  ) THEN
    RAISE EXCEPTION 'signup_not_invited';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- BEFORE INSERT, so a refused signup creates no user and no household.
DROP TRIGGER IF EXISTS enforce_signup_invite ON auth.users;
CREATE TRIGGER enforce_signup_invite
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_signup_invite();
