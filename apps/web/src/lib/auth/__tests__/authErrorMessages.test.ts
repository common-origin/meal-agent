import { describe, it, expect } from 'vitest';
import { AuthError } from '@supabase/supabase-js';
import { getAuthErrorMessage } from '../authErrorMessages';

describe('getAuthErrorMessage', () => {
  it('maps a known error code to friendly copy instead of the raw message', () => {
    const error = new AuthError('Email link is invalid or has expired', 403, 'otp_expired');

    const message = getAuthErrorMessage(error);

    expect(message).toBe('That sign-in link has expired. Request a new one below.');
    expect(message).not.toContain('Email link is invalid');
  });

  it('falls back to a sign-in-flavored generic message for an unrecognized AuthError', () => {
    const error = new AuthError('some internal detail nobody should see', 500, 'unexpected_failure');

    const message = getAuthErrorMessage(error, 'sign in');

    expect(message).toBe('Something went wrong trying to sign in. Please try again.');
    expect(message).not.toContain('internal detail');
  });

  it('falls back to a sign-up-flavored generic message when context is "sign up"', () => {
    const error = new AuthError('some internal detail', 500, 'unexpected_failure');

    const message = getAuthErrorMessage(error, 'sign up');

    expect(message).toBe('Something went wrong trying to sign up. Please try again.');
  });

  it('falls back to the generic message for a non-AuthError exception', () => {
    const message = getAuthErrorMessage(new TypeError('network request failed'), 'sign in');

    expect(message).toBe('Something went wrong trying to sign in. Please try again.');
  });

  it('falls back to the generic message for a completely unrecognized error code', () => {
    const error = new AuthError('whatever this is', 500, 'some_future_code_not_in_our_map');

    const message = getAuthErrorMessage(error);

    expect(message).toBe('Something went wrong trying to sign in. Please try again.');
  });

  it('defaults context to "sign in" when omitted', () => {
    const message = getAuthErrorMessage(new Error('boom'));

    expect(message).toBe('Something went wrong trying to sign in. Please try again.');
  });
});
