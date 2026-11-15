import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import HouseholdMembersSettings from '../HouseholdMembersSettings';
import type { HouseholdMembersResponse } from '@/lib/household/members';

function serve(body: HouseholdMembersResponse) {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(body)));
}

const owner = { userId: 'u1', email: 'owner@x.com', role: 'owner' as const, isMe: false };
const member = { userId: 'u2', email: 'partner@x.com', role: 'member' as const, isMe: false };
const invite = { id: 'i1', email: 'kid@x.com', expiresAt: '2026-12-01T00:00:00Z' };

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('Settings → Household members (#217)', () => {
  it('gives the owner Invite, Remove and Cancel, and Leave on their own card (it hands the household over)', async () => {
    serve({ members: [{ ...owner, isMe: true }, member], invites: [invite] });
    render(<HouseholdMembersSettings />);
    expect(await screen.findByText('owner@x.com (you)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Invite someone' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Leave' })).toHaveLength(1);
  });

  it('gives a member only Leave', async () => {
    serve({ members: [owner, { ...member, isMe: true }], invites: [invite] });
    render(<HouseholdMembersSettings />);
    expect(await screen.findByText('partner@x.com (you)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leave' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Invite someone' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it("says the household is full instead of offering an invite at 6 people", async () => {
    const people = Array.from({ length: 5 }, (_, i) => ({ ...member, userId: `m${i}`, email: `m${i}@x.com` }));
    serve({ members: [{ ...owner, isMe: true }, ...people], invites: [] });
    render(<HouseholdMembersSettings />);
    expect(await screen.findByText(/Your household is full/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Invite someone' })).not.toBeInTheDocument();
  });

  it('a household of one has nobody to remove and nowhere to leave', async () => {
    serve({ members: [{ ...owner, isMe: true }], invites: [] });
    render(<HouseholdMembersSettings />);
    expect(await screen.findByText('owner@x.com (you)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Leave' })).not.toBeInTheDocument();
  });
});
