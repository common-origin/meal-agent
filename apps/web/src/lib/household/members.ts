/**
 * Household members and invites (#217): the shapes the API returns, and the
 * copy for the errors migration 015's functions raise ('household:<reason>').
 */

/** People in a household at most, counting pending invites (matches migration 015). */
export const MAX_HOUSEHOLD_PEOPLE = 6;

/** Days an invite link works (matches migration 015). */
export const INVITE_DAYS = 14;

export interface HouseholdMember {
  userId: string;
  email: string;
  role: 'owner' | 'member';
  isMe: boolean;
}

export interface PendingInvite {
  id: string;
  email: string;
  expiresAt: string;
}

export interface HouseholdMembersResponse {
  members: HouseholdMember[];
  invites: PendingInvite[];
}

export interface InvitePreview {
  status: 'valid' | 'accepted' | 'expired' | 'not_found';
  inviteEmail: string | null;
  inviterEmail: string | null;
  emailMatches: boolean;
  alreadyMember: boolean;
  /** Joining deletes the user's current household and its data. */
  soleMember: boolean;
}

const HOUSEHOLD_ERRORS: Record<string, { status: number; message: string }> = {
  not_owner: { status: 403, message: 'Only the household owner can do that.' },
  invalid_email: { status: 400, message: 'Enter a valid email address.' },
  already_member: { status: 409, message: "They're already in your household." },
  full: { status: 409, message: `A household can have up to ${MAX_HOUSEHOLD_PEOPLE} people, counting invites.` },
  not_found: { status: 404, message: "We couldn't find that invite or member." },
  already_accepted: { status: 410, message: 'This invite has already been used.' },
  expired: { status: 410, message: 'This invite has expired. Ask for a new one.' },
  email_mismatch: { status: 403, message: 'This invite is for a different email. Sign in with the email it was sent to.' },
  only_member: { status: 409, message: "You're the only member, so there's no household to leave." },
};

/**
 * The status and copy for a Supabase error from one of the household
 * functions. Anything that isn't one of theirs is a 500.
 */
export function householdError(error: { message?: string } | null | undefined): { status: number; message: string; code: string } {
  const reason = /household:([a-z_]+)/.exec(error?.message ?? '')?.[1];
  const known = reason ? HOUSEHOLD_ERRORS[reason] : undefined;
  return known ? { ...known, code: reason! } : { status: 500, message: 'Something went wrong. Please try again.', code: 'unknown' };
}
