// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const tables = vi.hoisted(() => ({ fullSettings: null as unknown }));

/** The service-role client the feed reads: one household, its settings, one planned week, one recipe. */
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const result = {
        households: { data: { id: 'h1', name: 'Test' }, error: null },
        family_settings: { data: { full_settings: tables.fullSettings }, error: null },
        meal_plans: { data: [{ week_start: '2026-11-16', meals: { monday: { recipeId: 'r1' } } }], error: null },
        recipes: { data: [{ id: 'r1', title: 'Fish tacos' }], error: null },
      }[table];
      const query = {
        select: () => query,
        eq: () => query,
        gte: () => query,
        order: async () => result,
        single: async () => result,
        maybeSingle: async () => result,
        then: (resolve: (value: unknown) => unknown) => resolve(result),
      };
      return query;
    },
  }),
}));

import { GET } from '../route';

const feed = async () =>
  (await GET(new NextRequest('http://localhost/api/plan/ics/token'), { params: Promise.resolve({ token: 'token' }) })).text();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-17T00:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('ICS feed timezone (#220)', () => {
  it("puts dinner at 18:00 in the household's own zone", async () => {
    tables.fullSettings = { location: { city: 'Perth', country: 'Australia', hemisphere: 'southern', timeZone: 'Australia/Perth' } };
    const ics = await feed();
    expect(ics).toContain('DTSTART;TZID=Australia/Perth:20261116T180000');
    expect(ics).toContain('SUMMARY:Fish tacos');
  });

  it('falls back to Australia/Sydney when the household has no zone, or an unknown one', async () => {
    tables.fullSettings = { location: { city: 'Melbourne', country: 'Australia', hemisphere: 'southern' } };
    expect(await feed()).toContain('DTSTART;TZID=Australia/Sydney:20261116T180000');
    tables.fullSettings = { location: { timeZone: 'Not/AZone' } };
    expect(await feed()).toContain('TZID=Australia/Sydney');
    tables.fullSettings = null;
    expect(await feed()).toContain('TZID=Australia/Sydney');
  });
});
