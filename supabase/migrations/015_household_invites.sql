-- Migration: Invite a member to an existing household (issue #217)
--
-- 1. One household per user. The app has always assumed it
--    (getUserHousehold() uses .single(); get_user_household_id() LIMIT 1),
--    and now the database enforces it. Joining a household moves you.
-- 2. household_invites: an owner invites one email; the link /join/<token>
--    accepts it. A new user whose email has a pending invite joins at signup.
-- 3. Only an owner can update the household row (its name and its calendar
--    and extension tokens), and household_members changes only through the
--    functions below.
-- 4. Invite-only signup also lets in an email with a pending household
--    invite, for as long as the invite is pending. Nothing is added to
--    signup_invites, so cancelling or expiring the invite closes the door,
--    and the new account can only land in the inviting household.
--
-- Every write goes through the SECURITY DEFINER functions below, which check
-- the caller; there are no INSERT/UPDATE/DELETE policies on the new table.
-- Errors are raised as 'household:<reason>' for the API to turn into copy.
--
-- If step 1 fails with a duplicate key, a user is already in two households:
-- find them with
--   SELECT user_id FROM public.household_members GROUP BY 1 HAVING count(*) > 1;
-- remove the extra membership, and run this again.

-- ---------------------------------------------------------------------------
-- 1. One household per user
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_household_members_one_per_user ON public.household_members(user_id);

-- ---------------------------------------------------------------------------
-- 2. Invites
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.household_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  email TEXT NOT NULL CHECK (email = lower(email)),
  token UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '14 days',
  accepted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_household_invites_email ON public.household_invites(email);
CREATE INDEX IF NOT EXISTS idx_household_invites_household ON public.household_invites(household_id);

ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;

-- Members see their household's invites (Settings lists the pending ones).
DROP POLICY IF EXISTS "Members can view their household's invites" ON public.household_invites;
CREATE POLICY "Members can view their household's invites"
  ON public.household_invites FOR SELECT
  USING (household_id = public.get_user_household_id());

-- Not the token, though: the link is for the invited person alone.
REVOKE SELECT ON public.household_invites FROM anon, authenticated;
GRANT SELECT (id, household_id, email, invited_by, created_at, expires_at, accepted_at)
  ON public.household_invites TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Only owners update the household
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update their household name" ON public.households;
DROP POLICY IF EXISTS "Owners can update their household" ON public.households;
CREATE POLICY "Owners can update their household"
  ON public.households FOR UPDATE
  USING (
    id IN (
      SELECT household_id FROM public.household_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Membership changes only through the functions below: a direct delete would
-- leave the removed user with no household at all.
DROP POLICY IF EXISTS "Owners can add members to their household" ON public.household_members;
DROP POLICY IF EXISTS "Owners can remove members from their household" ON public.household_members;

-- ---------------------------------------------------------------------------
-- 4. Invite-only signup lets in a pending household invite
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_signup_invite()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS NULL OR NOT (
    EXISTS (SELECT 1 FROM public.signup_invites WHERE email = lower(NEW.email))
    OR EXISTS (
      SELECT 1 FROM public.household_invites
      WHERE email = lower(NEW.email) AND accepted_at IS NULL AND expires_at > now()
    )
  ) THEN
    RAISE EXCEPTION 'signup_not_invited';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- Helpers (not callable by users)
-- ---------------------------------------------------------------------------

-- A new household with p_user as its owner, default settings and an empty pantry.
CREATE OR REPLACE FUNCTION public._create_household_for(p_user UUID)
RETURNS UUID AS $$
DECLARE
  new_household_id UUID;
BEGIN
  INSERT INTO public.households (name) VALUES ('My Household') RETURNING id INTO new_household_id;
  INSERT INTO public.household_members (household_id, user_id, role) VALUES (new_household_id, p_user, 'owner');
  INSERT INTO public.family_settings (household_id) VALUES (new_household_id);
  INSERT INTO public.pantry_preferences (household_id) VALUES (new_household_id);
  RETURN new_household_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Takes p_user out of their household. If they were its only member, the
-- household and all its data are deleted; otherwise, if they were its owner,
-- the longest-standing remaining member becomes owner.
CREATE OR REPLACE FUNCTION public._leave_household(p_user UUID)
RETURNS VOID AS $$
DECLARE
  old_household UUID;
  old_role TEXT;
BEGIN
  SELECT household_id, role INTO old_household, old_role
  FROM public.household_members WHERE user_id = p_user;
  IF old_household IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.household_members WHERE household_id = old_household AND user_id <> p_user
  ) THEN
    DELETE FROM public.households WHERE id = old_household; -- cascades to its data
    RETURN;
  END IF;

  DELETE FROM public.household_members WHERE user_id = p_user;
  IF old_role = 'owner' THEN
    UPDATE public.household_members SET role = 'owner'
    WHERE id = (
      SELECT id FROM public.household_members
      WHERE household_id = old_household ORDER BY joined_at, id LIMIT 1
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public._create_household_for(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._leave_household(UUID) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- New users: join an invited household, or get their own
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  invite RECORD;
BEGIN
  SELECT id, household_id INTO invite
  FROM public.household_invites
  WHERE email = lower(NEW.email) AND accepted_at IS NULL AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    INSERT INTO public.household_members (household_id, user_id, role) VALUES (invite.household_id, NEW.id, 'member');
    UPDATE public.household_invites SET accepted_at = now() WHERE id = invite.id;
  ELSE
    PERFORM public._create_household_for(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- Functions the app calls (signed-in users only)
-- ---------------------------------------------------------------------------

-- People in a household, counting pending, unexpired invites.
CREATE OR REPLACE FUNCTION public._household_headcount(p_household UUID)
RETURNS INT AS $$
  SELECT (SELECT count(*) FROM public.household_members WHERE household_id = p_household)::INT
       + (SELECT count(*) FROM public.household_invites
          WHERE household_id = p_household AND accepted_at IS NULL AND expires_at > now())::INT;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public._household_headcount(UUID) FROM PUBLIC, anon, authenticated;

-- The owner invites p_email. Replaces a pending invite to the same email (a
-- resend gets a fresh link). While it's pending, enforce_signup_invite lets
-- the email sign up, straight into this household.
CREATE OR REPLACE FUNCTION public.create_household_invite(p_email TEXT)
RETURNS TABLE (id UUID, token UUID, email TEXT, expires_at TIMESTAMPTZ) AS $$
DECLARE
  my_household UUID;
  clean_email TEXT := lower(trim(p_email));
BEGIN
  SELECT hm.household_id INTO my_household
  FROM public.household_members hm WHERE hm.user_id = auth.uid() AND hm.role = 'owner';
  IF my_household IS NULL THEN
    RAISE EXCEPTION 'household:not_owner';
  END IF;
  IF clean_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'household:invalid_email';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.household_members hm JOIN auth.users u ON u.id = hm.user_id
    WHERE hm.household_id = my_household AND lower(u.email) = clean_email
  ) THEN
    RAISE EXCEPTION 'household:already_member';
  END IF;

  DELETE FROM public.household_invites hi
  WHERE hi.household_id = my_household AND hi.email = clean_email AND hi.accepted_at IS NULL;

  IF public._household_headcount(my_household) >= 6 THEN
    RAISE EXCEPTION 'household:full';
  END IF;

  RETURN QUERY
  INSERT INTO public.household_invites (household_id, email, invited_by)
  VALUES (my_household, clean_email, auth.uid())
  RETURNING household_invites.id, household_invites.token, household_invites.email, household_invites.expires_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- The owner cancels a pending invite to their household.
CREATE OR REPLACE FUNCTION public.cancel_household_invite(p_invite UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM public.household_invites hi
  WHERE hi.id = p_invite AND hi.accepted_at IS NULL
    AND hi.household_id IN (
      SELECT household_id FROM public.household_members WHERE user_id = auth.uid() AND role = 'owner'
    );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'household:not_found';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- What /join/<token> shows before accepting. status: valid, accepted (by
-- someone, maybe you), expired or not_found. already_member: you're in that
-- household now. sole_member: joining deletes your current household's data.
CREATE OR REPLACE FUNCTION public.household_invite_preview(p_token UUID)
RETURNS TABLE (status TEXT, invite_email TEXT, inviter_email TEXT, email_matches BOOLEAN, already_member BOOLEAN, sole_member BOOLEAN) AS $$
DECLARE
  invite RECORD;
  my_email TEXT;
  my_household UUID;
BEGIN
  SELECT hi.* INTO invite FROM public.household_invites hi WHERE hi.token = p_token;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::TEXT, NULL::TEXT, NULL::TEXT, FALSE, FALSE, FALSE;
    RETURN;
  END IF;

  SELECT lower(u.email) INTO my_email FROM auth.users u WHERE u.id = auth.uid();
  SELECT hm.household_id INTO my_household FROM public.household_members hm WHERE hm.user_id = auth.uid();

  RETURN QUERY SELECT
    CASE WHEN invite.accepted_at IS NOT NULL THEN 'accepted'
         WHEN invite.expires_at <= now() THEN 'expired'
         ELSE 'valid' END,
    invite.email,
    (SELECT u.email::TEXT FROM auth.users u WHERE u.id = invite.invited_by),
    COALESCE(invite.email = my_email, FALSE),
    my_household IS NOT DISTINCT FROM invite.household_id,
    NOT EXISTS (
      SELECT 1 FROM public.household_members hm WHERE hm.household_id = my_household AND hm.user_id <> auth.uid()
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Accepts an invite for the signed-in user, whose email must match it, and
-- moves them into the household. Returns the household.
CREATE OR REPLACE FUNCTION public.accept_household_invite(p_token UUID)
RETURNS UUID AS $$
DECLARE
  invite RECORD;
  my_email TEXT;
BEGIN
  SELECT hi.* INTO invite FROM public.household_invites hi WHERE hi.token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'household:not_found';
  END IF;
  IF EXISTS (SELECT 1 FROM public.household_members WHERE user_id = auth.uid() AND household_id = invite.household_id) THEN
    RETURN invite.household_id; -- already in (e.g. joined at signup)
  END IF;
  IF invite.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'household:already_accepted';
  END IF;
  IF invite.expires_at <= now() THEN
    RAISE EXCEPTION 'household:expired';
  END IF;
  SELECT lower(u.email) INTO my_email FROM auth.users u WHERE u.id = auth.uid();
  IF my_email IS DISTINCT FROM invite.email THEN
    RAISE EXCEPTION 'household:email_mismatch';
  END IF;

  PERFORM public._leave_household(auth.uid());
  INSERT INTO public.household_members (household_id, user_id, role) VALUES (invite.household_id, auth.uid(), 'member');
  UPDATE public.household_invites SET accepted_at = now() WHERE id = invite.id;
  RETURN invite.household_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- The signed-in user's household, with emails (auth.users isn't readable by users).
CREATE OR REPLACE FUNCTION public.household_member_list()
RETURNS TABLE (user_id UUID, email TEXT, role TEXT, joined_at TIMESTAMPTZ, is_me BOOLEAN) AS $$
  SELECT hm.user_id, u.email::TEXT, hm.role, hm.joined_at, hm.user_id = auth.uid()
  FROM public.household_members hm JOIN auth.users u ON u.id = hm.user_id
  WHERE hm.household_id = public.get_user_household_id()
  ORDER BY hm.joined_at, hm.id;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- The owner removes a member, or anyone leaves (p_user = themselves). The
-- person removed gets a fresh, empty household of their own. The only member
-- can't leave: there's nowhere to go.
CREATE OR REPLACE FUNCTION public.remove_household_member(p_user UUID)
RETURNS VOID AS $$
DECLARE
  my_household UUID := public.get_user_household_id();
  i_am_owner BOOLEAN;
BEGIN
  IF my_household IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.household_members WHERE household_id = my_household AND user_id = p_user
  ) THEN
    RAISE EXCEPTION 'household:not_found';
  END IF;
  SELECT role = 'owner' INTO i_am_owner FROM public.household_members WHERE user_id = auth.uid();
  IF p_user <> auth.uid() AND NOT i_am_owner THEN
    RAISE EXCEPTION 'household:not_owner';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.household_members WHERE household_id = my_household AND user_id <> p_user) THEN
    RAISE EXCEPTION 'household:only_member';
  END IF;

  PERFORM public._leave_household(p_user);
  PERFORM public._create_household_for(p_user);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.create_household_invite(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_household_invite(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.household_invite_preview(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_household_invite(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.household_member_list() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_household_member(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_household_invite(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_household_invite(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.household_invite_preview(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_household_invite(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.household_member_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_household_member(UUID) TO authenticated;
