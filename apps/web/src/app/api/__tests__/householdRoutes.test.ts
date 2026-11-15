// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getUserHousehold: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  getCurrentUser: mocks.getCurrentUser,
  getUserHousehold: mocks.getUserHousehold,
  createClient: async () => ({ rpc: mocks.rpc, from: mocks.from }),
}));
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mocks.sendEmail };
  },
}));

import { GET as membersGET, DELETE as membersDELETE } from '../household/members/route';
import { POST as invitesPOST, DELETE as invitesDELETE } from '../household/invites/route';
import { GET as joinGET, POST as joinPOST } from '../household/join/route';
import { POST as extensionTokenPOST, GET as extensionTokenGET } from '../household/extension-token/route';
import { householdError } from '@/lib/household/members';
import { inviteEmail } from '@/lib/household/inviteEmail';

const TOKEN = '11111111-2222-4333-8444-555555555555';
let userCounter = 0;
const signIn = () => mocks.getCurrentUser.mockResolvedValue({ id: `user-${++userCounter}`, email: 'owner@example.com' });
const json = (url: string, method: string, body?: unknown) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

/** A query builder for household_invites that resolves to `rows`. */
function invitesQuery(rows: unknown[]) {
  const query = { select: () => query, is: () => query, gt: () => query, order: async () => ({ data: rows, error: null }) };
  return query;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.stubEnv('RESEND_API_KEY', 're_test');
  vi.stubEnv('RESEND_FROM_ADDRESS', 'Meal Agent <hi@example.com>');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://meal-agent.example');
  mocks.sendEmail.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('householdError (#217)', () => {
  it("turns the database's household:<reason> into copy and a status", () => {
    expect(householdError({ message: 'household:full' })).toMatchObject({ status: 409, code: 'full' });
    expect(householdError({ message: 'household:email_mismatch' })).toMatchObject({ status: 403 });
    expect(householdError({ message: 'connection refused' })).toMatchObject({ status: 500, code: 'unknown' });
  });
});

describe('inviteEmail', () => {
  it('names the inviter, links the join page and escapes HTML', () => {
    const { subject, text, html } = inviteEmail('sam<script>@example.com', 'https://x/join/t');
    expect(subject).toContain('invited you');
    expect(text).toContain('https://x/join/t');
    expect(html).not.toContain('<script>');
    expect(html).toContain('href="https://x/join/t"');
  });
});

describe('/api/household/members', () => {
  it('refuses a signed-out request', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    expect((await membersGET()).status).toBe(401);
  });

  it('lists members and pending invites', async () => {
    signIn();
    mocks.rpc.mockResolvedValue({ data: [{ user_id: 'u1', email: 'a@x.com', role: 'owner', joined_at: '', is_me: true }], error: null });
    mocks.from.mockReturnValue(invitesQuery([{ id: 'i1', email: 'b@x.com', expires_at: '2026-12-01T00:00:00Z' }]));
    const body = await (await membersGET()).json();
    expect(body).toEqual({
      members: [{ userId: 'u1', email: 'a@x.com', role: 'owner', isMe: true }],
      invites: [{ id: 'i1', email: 'b@x.com', expiresAt: '2026-12-01T00:00:00Z' }],
    });
  });

  it('removes a member, passing the database refusal through as copy', async () => {
    signIn();
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'household:not_owner' } });
    const res = await membersDELETE(json('/api/household/members?userId=u2', 'DELETE'));
    expect(res.status).toBe(403);
    expect(mocks.rpc).toHaveBeenCalledWith('remove_household_member', { p_user: 'u2' });
  });
});

describe('/api/household/invites', () => {
  it('creates the invite and emails the join link, replying to the owner', async () => {
    signIn();
    mocks.rpc.mockResolvedValue({ data: [{ id: 'i1', token: TOKEN, email: 'partner@x.com', expires_at: '2026-12-01' }], error: null });
    const res = await invitesPOST(json('/api/household/invites', 'POST', { email: 'Partner@x.com' }));
    expect(res.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('create_household_invite', { p_email: 'Partner@x.com' });
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'partner@x.com',
      replyTo: 'owner@example.com',
      text: expect.stringContaining(`https://meal-agent.example/join/${TOKEN}`),
    }));
    expect(await res.json()).toMatchObject({ emailed: true });
  });

  it('returns the link to share by hand when the email fails', async () => {
    signIn();
    mocks.rpc.mockResolvedValue({ data: [{ id: 'i1', token: TOKEN, email: 'partner@x.com', expires_at: '2026-12-01' }], error: null });
    mocks.sendEmail.mockResolvedValue({ error: { message: 'down' } });
    const body = await (await invitesPOST(json('/api/household/invites', 'POST', { email: 'partner@x.com' }))).json();
    expect(body).toMatchObject({ emailed: false, joinUrl: `https://meal-agent.example/join/${TOKEN}` });
  });

  it("doesn't email when the database refuses (e.g. not the owner, or full)", async () => {
    signIn();
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'household:full' } });
    const res = await invitesPOST(json('/api/household/invites', 'POST', { email: 'partner@x.com' }));
    expect(res.status).toBe(409);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('refuses an empty email without calling the database', async () => {
    signIn();
    expect((await invitesPOST(json('/api/household/invites', 'POST', { email: ' ' }))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('cancels an invite', async () => {
    signIn();
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    expect((await invitesDELETE(json('/api/household/invites?id=i1', 'DELETE'))).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('cancel_household_invite', { p_invite: 'i1' });
  });
});

describe('/api/household/join', () => {
  it('previews the invite for the signed-in user', async () => {
    signIn();
    mocks.rpc.mockResolvedValue({
      data: [{ status: 'valid', invite_email: 'b@x.com', inviter_email: 'a@x.com', email_matches: true, already_member: false, sole_member: true }],
      error: null,
    });
    const body = await (await joinGET(json(`/api/household/join?token=${TOKEN}`, 'GET'))).json();
    expect(body).toEqual({ status: 'valid', inviteEmail: 'b@x.com', inviterEmail: 'a@x.com', emailMatches: true, alreadyMember: false, soleMember: true });
  });

  it("treats a token that isn't a UUID as not found, without calling the database", async () => {
    signIn();
    expect((await joinGET(json('/api/household/join?token=nope', 'GET'))).status).toBe(404);
    expect((await joinPOST(json('/api/household/join', 'POST', { token: "'; drop" }))).status).toBe(404);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('accepts, and passes an email mismatch through as a 403', async () => {
    signIn();
    mocks.rpc.mockResolvedValueOnce({ data: 'h1', error: null });
    expect((await joinPOST(json('/api/household/join', 'POST', { token: TOKEN }))).status).toBe(200);
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'household:email_mismatch' } });
    expect((await joinPOST(json('/api/household/join', 'POST', { token: TOKEN }))).status).toBe(403);
  });

  it('refuses a signed-out request', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    expect((await joinPOST(json('/api/household/join', 'POST', { token: TOKEN }))).status).toBe(401);
  });
});

describe('extension token: only the owner replaces it (#217)', () => {
  it('refuses a member with 403, and says so on GET', async () => {
    mocks.getUserHousehold.mockResolvedValue({ household_id: 'h1', role: 'member' });
    expect((await extensionTokenPOST()).status).toBe(403);
    mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ single: async () => ({ data: { extension_token: 't' }, error: null }) }) }) });
    expect(await (await extensionTokenGET()).json()).toEqual({ token: 't', canReplace: false });
  });
});
