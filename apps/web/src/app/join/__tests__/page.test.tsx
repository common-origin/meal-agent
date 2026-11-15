import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { InvitePreview } from '@/lib/household/members';

vi.mock('next/navigation', () => ({ useParams: () => ({ token: '11111111-2222-4333-8444-555555555555' }) }));
const clearHouseholdScopedCaches = vi.fn();
vi.mock('@/lib/storage', () => ({ clearHouseholdScopedCaches: () => clearHouseholdScopedCaches() }));

import JoinHouseholdPage from '../[token]/page';

const base: InvitePreview = {
  status: 'valid',
  inviteEmail: 'partner@x.com',
  inviterEmail: 'owner@x.com',
  emailMatches: true,
  alreadyMember: false,
  soleMember: true,
};

function serve(preview: InvitePreview | null, accept: { status: number; body: unknown } = { status: 200, body: { ok: true } }) {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === 'POST'
      ? Response.json(accept.body, { status: accept.status })
      : preview ? Response.json(preview) : Response.json({ error: 'nope' }, { status: 404 })));
}

const assign = vi.fn();
beforeEach(() => {
  clearHouseholdScopedCaches.mockClear();
  assign.mockClear();
  Object.defineProperty(window, 'location', { value: { assign }, writable: true });
});
afterEach(() => vi.unstubAllGlobals());

describe('/join/<token> (#217)', () => {
  it('warns that joining deletes your own household, then joins and starts fresh', async () => {
    serve(base);
    render(<JoinHouseholdPage />);
    expect(await screen.findByText("Join owner@x.com's household?")).toBeInTheDocument();
    expect(screen.getByText(/will be deleted/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Join household' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/plan'));
    expect(clearHouseholdScopedCaches).toHaveBeenCalled();
  });

  it("says you'll leave a shared household rather than delete it", async () => {
    serve({ ...base, soleMember: false });
    render(<JoinHouseholdPage />);
    expect(await screen.findByText(/You'll leave your current household/)).toBeInTheDocument();
  });

  it("says you're in when signup already joined you", async () => {
    serve({ ...base, status: 'accepted', alreadyMember: true });
    render(<JoinHouseholdPage />);
    expect(await screen.findByText("You're in")).toBeInTheDocument();
  });

  it('names the email the invite is for when you are signed in as someone else', async () => {
    serve({ ...base, emailMatches: false });
    render(<JoinHouseholdPage />);
    expect(await screen.findByText(/This invite is for partner@x.com/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Join household' })).not.toBeInTheDocument();
  });

  it.each([
    ['expired', /expired/],
    ['accepted', /already been used/],
  ] as const)('explains a %s invite', async (status, text) => {
    serve({ ...base, status });
    render(<JoinHouseholdPage />);
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it("treats a link that doesn't exist as not found", async () => {
    serve(null);
    render(<JoinHouseholdPage />);
    expect(await screen.findByText(/couldn't find it/)).toBeInTheDocument();
  });

  it('shows the refusal and stays put when joining fails', async () => {
    serve(base, { status: 410, body: { error: 'This invite has expired. Ask for a new one.' } });
    render(<JoinHouseholdPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Join household' }));
    expect(await screen.findByText('This invite has expired. Ask for a new one.')).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });
});
