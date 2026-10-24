import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const push = vi.fn();
let params = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => params,
}));

const signInWithOAuth = vi.fn<(options: unknown) => Promise<{ error: null }>>(async () => ({ error: null }));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signInWithOAuth } }),
}));

import LoginPage from '../page';
import SignupPage from '../../signup/page';

describe('/login and /signup read the URL after the form renders (#164)', () => {
  beforeEach(() => {
    push.mockReset();
    signInWithOAuth.mockClear();
    params = new URLSearchParams();
  });

  it('shows the callback error and keeps redirectTo through sign-in and the switch to sign-up', async () => {
    params = new URLSearchParams({ redirectTo: '/plan', error: 'otp_expired' });
    render(<LoginPage />);

    expect(screen.getByText('Welcome back')).toBeInTheDocument();
    // getAuthErrorMessageForCode's copy for an expired link
    expect(await screen.findByText(/expired/i)).toBeInTheDocument();

    // Before sign-in starts: once it does, the form waits for the redirect with its buttons disabled
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    expect(push).toHaveBeenCalledWith('/signup?redirectTo=%2Fplan');

    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalled());
    expect(JSON.stringify(signInWithOAuth.mock.calls[0][0])).toContain('next=%2Fplan');
  });

  it('renders the plain form without URL values', () => {
    render(<LoginPage />);
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    expect(push).toHaveBeenCalledWith('/signup');
  });

  it('keeps redirectTo on /signup', () => {
    params = new URLSearchParams({ redirectTo: '/plan' });
    render(<SignupPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(push).toHaveBeenCalledWith('/login?redirectTo=%2Fplan');
  });
});
