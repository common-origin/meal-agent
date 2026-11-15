// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const { getCurrentUser, claimColesLookup, readColesQuota } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  claimColesLookup: vi.fn(),
  readColesQuota: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  getCurrentUser,
  getUserHousehold: async () => ({ household_id: 'h1', role: 'owner' }),
}));
vi.mock('@/lib/coles/quota', () => ({ claimColesLookup, readColesQuota }));

import { GET as colesQuotaGET, POST as colesSearchPOST } from '../coles-search/route';
import { GET as customRecipesGET } from '../debug/custom-recipes/route';

const search = (query = 'milk') =>
  colesSearchPOST(
    new NextRequest('https://example.com/api/coles-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
  );

let userCounter = 0;
const signIn = (email = 'someone@example.com') =>
  getCurrentUser.mockResolvedValue({ id: `user-${++userCounter}`, email });

const quota = (used: number) => ({ used, limit: 1000, remaining: 1000 - used, month: '2026-11' });

beforeEach(() => {
  getCurrentUser.mockReset();
  claimColesLookup.mockReset().mockResolvedValue({ status: 'granted', quota: quota(1) });
  readColesQuota.mockReset().mockResolvedValue(quota(0));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubEnv('RAPIDAPI_KEY', 'test-key');
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ products: [{ name: 'Milk 2L', price: '$3.10' }] })));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('coles-search', () => {
  it('refuses a signed-out request without spending the RapidAPI quota', async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await search();
    expect(res.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('searches for a signed-in user', async () => {
    signIn();
    const res = await search();
    expect(res.status).toBe(200);
    expect((await res.json()).results[0].productName).toBe('Milk 2L');
  });

  it('counts each search against the shared monthly quota, and reports it (#227)', async () => {
    signIn();
    const body = await (await search()).json();
    expect(claimColesLookup).toHaveBeenCalledWith('h1');
    expect(body.quota).toEqual(quota(1));
  });

  it("stops calling RapidAPI once the month's shared lookups are used up (#227)", async () => {
    signIn();
    claimColesLookup.mockResolvedValue({ status: 'exceeded', quota: quota(1000) });
    const res = await search();
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ code: 'quota_exceeded', quota: { remaining: 0 } });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses when the quota can't be counted (#227)", async () => {
    signIn();
    claimColesLookup.mockResolvedValue({ status: 'unavailable' });
    const res = await search();
    expect(res.status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("GET reports the month's shared lookups to a signed-in user (#227)", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect((await colesQuotaGET()).status).toBe(401);
    signIn();
    expect(await (await colesQuotaGET()).json()).toEqual(quota(0));
    readColesQuota.mockResolvedValue(null);
    expect((await colesQuotaGET()).status).toBe(503);
  });

  it('rate limits each user to 150 searches per 10 minutes', async () => {
    signIn();
    for (let i = 0; i < 150; i++) expect((await search()).status).toBe(200);
    const res = await search();
    expect(res.status).toBe(429);
    expect(fetch).toHaveBeenCalledTimes(150);
  });
});

describe('/api/debug/custom-recipes', () => {
  it('is a 404 for anyone but an admin', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'owner@example.com');
    getCurrentUser.mockResolvedValue(null);
    expect((await customRecipesGET()).status).toBe(404);
    signIn('guest@example.com');
    expect((await customRecipesGET()).status).toBe(404);
  });

  it('answers an admin', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'owner@example.com');
    signIn('owner@example.com');
    expect((await customRecipesGET()).status).toBe(200);
  });
});
