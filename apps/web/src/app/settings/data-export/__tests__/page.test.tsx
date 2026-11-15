import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { email: 'owner@example.com' }, loading: false }) }));
const signOut = vi.fn<(options?: { scope?: string }) => Promise<{ error: null }>>(async () => ({ error: null }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { signOut } }) }));
const clearHouseholdScopedCaches = vi.fn();
vi.mock('@/lib/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/storage')>()),
  clearHouseholdScopedCaches: () => clearHouseholdScopedCaches(),
}));

import YourDataPage from '../page';

const assign = vi.fn();
beforeEach(() => {
  signOut.mockClear();
  clearHouseholdScopedCaches.mockClear();
  assign.mockClear();
  Object.defineProperty(window, 'location', { value: { assign }, writable: true });
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

describe('Settings → Your data (#224)', () => {
  it("downloads the household's data with this browser's", async () => {
    const fetchMock = vi.fn(async () => Response.json({ version: 2, recipes: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<YourDataPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Download my data' }));
    expect(await screen.findByText(/Downloaded/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/account/export');
    expect(click).toHaveBeenCalled();
  });

  it('only deletes once the email is typed, then signs out locally and leaves', async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    render(<YourDataPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }));
    const confirm = await screen.findByRole('button', { name: 'Delete account' });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('owner@example.com'), { target: { value: 'Owner@Example.com' } });
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/'));
    expect(fetchMock).toHaveBeenCalledWith('/api/account/delete', expect.objectContaining({ method: 'POST' }));
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(clearHouseholdScopedCaches).toHaveBeenCalled();
  });

  it('shows the refusal and stays signed in when deletion fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: "Your account couldn't be deleted. Please try again." }, { status: 500 })));
    render(<YourDataPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }));
    fireEvent.change(screen.getByPlaceholderText('owner@example.com'), { target: { value: 'owner@example.com' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Delete account' }));
    expect(await screen.findByText(/couldn't be deleted/)).toBeInTheDocument();
    expect(signOut).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });
});
