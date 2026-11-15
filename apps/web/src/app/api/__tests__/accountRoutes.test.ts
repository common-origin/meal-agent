// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getUserHousehold: vi.fn(),
  rpc: vi.fn(),
  selects: [] as { table: string; columns: string }[],
  rows: {} as Record<string, unknown[]>,
}));

/** A session client: each table returns mocks.rows[table], paged by range(). */
function fakeClient() {
  return {
    rpc: mocks.rpc,
    from: (table: string) => {
      let range: [number, number] | null = null;
      const all = () => mocks.rows[table] ?? [];
      const query = {
        select: (columns: string) => {
          mocks.selects.push({ table, columns });
          return query;
        },
        eq: () => query,
        order: () => query,
        range: (from: number, to: number) => {
          range = [from, to];
          return query;
        },
        maybeSingle: async () => ({ data: all()[0] ?? null, error: null }),
        then: (resolve: (value: unknown) => unknown) =>
          resolve({ data: range ? all().slice(range[0], range[1] + 1) : all(), error: null }),
      };
      return query;
    },
  };
}

vi.mock('@/lib/supabase/server', () => ({
  getCurrentUser: mocks.getCurrentUser,
  getUserHousehold: mocks.getUserHousehold,
  createClient: async () => fakeClient(),
}));

import { GET as exportGET } from '../account/export/route';
import { POST as deletePOST } from '../account/delete/route';

const user = { id: 'u1', email: 'Owner@Example.com' };
const deleteRequest = (confirmEmail: unknown) =>
  new NextRequest('http://localhost/api/account/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmEmail }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.selects = [];
  mocks.rows = {};
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.getCurrentUser.mockResolvedValue(user);
  mocks.getUserHousehold.mockResolvedValue({ household_id: 'h1', role: 'owner' });
  mocks.rpc.mockResolvedValue({ data: [], error: null });
});

describe('GET /api/account/export (#224)', () => {
  it('returns the household\'s data, reading every page of a long table', async () => {
    mocks.rows = {
      households: [{ id: 'h1', name: 'Home' }],
      purchase_history: Array.from({ length: 2500 }, (_, i) => ({ id: i })),
      recipes: [{ id: 'r1' }],
    };
    const body = await (await exportGET()).json();
    expect(body).toMatchObject({ version: 2, account: { id: 'u1', email: 'Owner@Example.com' }, household: { id: 'h1', name: 'Home' } });
    expect(body.colesOrders).toHaveLength(2500);
    expect(body.recipes).toEqual([{ id: 'r1' }]);
  });

  it('leaves out the calendar and extension tokens, and invite links', async () => {
    await exportGET();
    const columns = (table: string) => mocks.selects.find((s) => s.table === table)?.columns ?? '';
    expect(columns('households')).not.toMatch(/token|\*/);
    expect(columns('household_invites')).not.toMatch(/token|\*/);
  });

  it('refuses a signed-out request', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    expect((await exportGET()).status).toBe(401);
  });

  it('is rate limited: a 6th export within 10 minutes gets 429', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'u-rate', email: 'r@x.com' });
    for (let i = 0; i < 5; i++) expect((await exportGET()).status).toBe(200);
    expect((await exportGET()).status).toBe(429);
  });
});

describe('POST /api/account/delete (#224)', () => {
  it('deletes when the typed email matches, ignoring case and spaces', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    const res = await deletePOST(deleteRequest('  owner@example.com '));
    expect(res.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('delete_my_account');
  });

  it("refuses without calling the database when the email doesn't match", async () => {
    expect((await deletePOST(deleteRequest('someone@else.com'))).status).toBe(400);
    expect((await deletePOST(deleteRequest(undefined))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('asks an account with no email to type DELETE instead', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'u2', email: undefined });
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    expect((await deletePOST(deleteRequest(''))).status).toBe(400);
    expect((await deletePOST(deleteRequest('delete'))).status).toBe(200);
  });

  it('reports a database failure', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect((await deletePOST(deleteRequest('owner@example.com'))).status).toBe(500);
  });

  it('refuses a signed-out request', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    expect((await deletePOST(deleteRequest('owner@example.com'))).status).toBe(401);
  });
});
