import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimit, getRateLimitStats, refreshColesQuota, resetColesQuotaForTests, searchColesProducts } from '../colesApi';

const month = () => new Date().toISOString().slice(0, 7);
const quota = (used: number) => ({ used, limit: 1000, remaining: Math.max(0, 1000 - used), month: month() });

beforeEach(() => {
  resetColesQuotaForTests();
  localStorage.clear();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => vi.unstubAllGlobals());

describe('Coles lookups in the browser follow the shared quota (#227)', () => {
  it('shows the count the server reports, not one kept per browser', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(quota(640))));
    expect(await refreshColesQuota()).toEqual(quota(640));
    expect(getRateLimitStats().remaining).toBe(360);
  });

  it("stops asking once the server says the month's lookups are used up", async () => {
    const fetchMock = vi.fn(async () => Response.json({ error: 'used up', code: 'quota_exceeded', quota: quota(1000) }, { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await searchColesProducts('milk')).toBeNull();
    expect(checkRateLimit()).toEqual({ allowed: false, remaining: 0 });
    expect(await searchColesProducts('bread')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('treats a 429 without a quota (the per-user burst limit) as a plain failure, not the month used up', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'slow down', code: 'rate_limited' }, { status: 429 })));
    expect(await searchColesProducts('milk')).toBeNull();
    expect(checkRateLimit().allowed).toBe(true);
    expect(console.error).not.toHaveBeenCalledWith('Coles API search error:', expect.anything());
  });

  it('keeps the quota out of the cached search result', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ query: 'milk', totalResults: 0, totalPages: 1, currentPage: 1, results: [], quota: quota(5) })));
    const result = await searchColesProducts('milk');
    expect(result).not.toHaveProperty('quota');
    expect(getRateLimitStats().used).toBe(5);
  });

  it("ignores a report from an earlier month (the count has reset)", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ...quota(1000), month: '2020-01' })));
    await refreshColesQuota();
    expect(checkRateLimit().allowed).toBe(true);
  });
});
