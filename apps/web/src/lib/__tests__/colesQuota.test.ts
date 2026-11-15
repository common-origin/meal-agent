// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, emailAdmins } = vi.hoisted(() => ({ rpc: vi.fn(), emailAdmins: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => ({ rpc }) }));
vi.mock('@/lib/adminAlerts', () => ({ emailAdmins }));

import { claimColesLookup, colesMonthlyLimit, readColesQuota, resetQuotaAlertForTests, startOfUtcMonth } from '../coles/quota';

// 9:30am on 1 December in Sydney, but still November in UTC, which is what's counted.
const now = new Date('2026-12-01T09:30:00+10:00');

beforeEach(() => {
  rpc.mockReset();
  emailAdmins.mockReset();
  resetQuotaAlertForTests();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => vi.unstubAllEnvs());

describe('Coles lookup quota (#227)', () => {
  it('counts from midnight UTC on the 1st', () => {
    expect(startOfUtcMonth(now)).toBe('2026-11-01T00:00:00.000Z');
    expect(startOfUtcMonth(new Date('2026-12-01T05:00:00+10:00'))).toBe('2026-11-01T00:00:00.000Z');
  });

  it('allows 1,000 a month unless COLES_API_MONTHLY_LIMIT is a positive whole number', () => {
    expect(colesMonthlyLimit({})).toBe(1000);
    expect(colesMonthlyLimit({ COLES_API_MONTHLY_LIMIT: '800' })).toBe(800);
    expect(colesMonthlyLimit({ COLES_API_MONTHLY_LIMIT: '0' })).toBe(1000);
    expect(colesMonthlyLimit({ COLES_API_MONTHLY_LIMIT: 'lots' })).toBe(1000);
    expect(colesMonthlyLimit({ COLES_API_MONTHLY_LIMIT: '12.5' })).toBe(1000);
  });

  it('claims a lookup for the household against the month\'s limit', async () => {
    vi.stubEnv('COLES_API_MONTHLY_LIMIT', '500');
    rpc.mockResolvedValue({ data: [{ granted: true, used: 42 }], error: null });
    expect(await claimColesLookup('h1', now)).toEqual({ status: 'granted', quota: { used: 42, limit: 500, remaining: 458, month: '2026-11' } });
    expect(rpc).toHaveBeenCalledWith('claim_api_call', { p_household: 'h1', p_endpoint: 'coles-search', p_limit: 500, p_since: '2026-11-01T00:00:00.000Z' });
  });

  it('reports a refused claim as exceeded', async () => {
    rpc.mockResolvedValue({ data: [{ granted: false, used: 1000 }], error: null });
    expect(await claimColesLookup('h1', now)).toMatchObject({ status: 'exceeded', quota: { remaining: 0 } });
  });

  it('emails the owner once a month when the quota runs out, again if the email fails', async () => {
    rpc.mockResolvedValue({ data: [{ granted: false, used: 1000 }], error: null });
    await claimColesLookup('h1', now);
    await claimColesLookup('h2', now);
    expect(emailAdmins).toHaveBeenCalledTimes(1);
    expect(emailAdmins.mock.calls[0][0].subject).toMatch(/Coles lookups are used up/);
    emailAdmins.mock.calls[0][0].onFailure();
    await claimColesLookup('h1', now);
    expect(emailAdmins).toHaveBeenCalledTimes(2);
    await claimColesLookup('h1', new Date('2026-12-02T00:00:00Z'));
    expect(emailAdmins).toHaveBeenCalledTimes(3);
  });

  it('fails closed when the count can\'t be read', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'function claim_api_call does not exist' } });
    expect(await claimColesLookup('h1', now)).toEqual({ status: 'unavailable' });
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await claimColesLookup('h1', now)).toEqual({ status: 'unavailable' });
    rpc.mockRejectedValue(new Error('network'));
    expect(await readColesQuota(now)).toBeNull();
  });

  it('reads the month\'s total across households', async () => {
    rpc.mockResolvedValue({ data: 990, error: null });
    expect(await readColesQuota(now)).toEqual({ used: 990, limit: 1000, remaining: 10, month: '2026-11' });
    expect(rpc).toHaveBeenCalledWith('api_calls_since', { p_endpoint: 'coles-search', p_since: '2026-11-01T00:00:00.000Z' });
  });
});
