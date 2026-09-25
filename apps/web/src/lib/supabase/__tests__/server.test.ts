import { describe, it, expect, vi, beforeEach } from 'vitest';

const getUserMock = vi.fn();
const householdSelectMock = vi.fn();
const eqMock = vi.fn(() => ({ single: householdSelectMock }));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: vi.fn(),
  })),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: getUserMock,
    },
    from: () => ({
      select: () => ({
        eq: eqMock,
      }),
    }),
  }),
}));

import { getCurrentUser, getUserHousehold } from '../server';

describe('getCurrentUser', () => {
  beforeEach(() => {
    getUserMock.mockReset();
  });

  it('returns the user on success', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });

    const user = await getCurrentUser();

    expect(user).toEqual({ id: 'user-1' });
  });

  it('returns null when there is no session', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const user = await getCurrentUser();

    expect(user).toBeNull();
  });

  it('returns null (rather than throwing) when Supabase Auth errors', async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: new Error('auth server unreachable'),
    });

    const user = await getCurrentUser();

    expect(user).toBeNull();
  });
});

describe('getUserHousehold', () => {
  beforeEach(() => {
    getUserMock.mockReset();
    householdSelectMock.mockReset();
    eqMock.mockClear();
  });

  it('returns null without querying the household when there is no user', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const household = await getUserHousehold();

    expect(household).toBeNull();
    expect(householdSelectMock).not.toHaveBeenCalled();
  });

  it("returns the caller's own household when found", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    householdSelectMock.mockResolvedValue({
      data: { household_id: 'household-1', households: { name: 'The Smiths' } },
      error: null,
    });

    const household = await getUserHousehold();

    expect(household).toEqual({
      household_id: 'household-1',
      households: { name: 'The Smiths' },
    });
    // Not just that a lookup happened, but that it was scoped to the
    // authenticated caller -- a regression that unscopes or misscopes
    // this query would otherwise still pass this test.
    expect(eqMock).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('returns null when the household lookup errors', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    householdSelectMock.mockResolvedValue({
      data: null,
      error: new Error('not found'),
    });

    const household = await getUserHousehold();

    expect(household).toBeNull();
  });
});
