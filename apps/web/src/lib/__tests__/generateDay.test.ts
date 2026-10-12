import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateDay, type DayRequest } from '../client/generateDay';
import { DEFAULT_FAMILY_SETTINGS } from '../types/settings';
import { GENERIC_ERROR_MESSAGE } from '../api/client';

const request: DayRequest = {
  familySettings: DEFAULT_FAMILY_SETTINGS,
  slot: { index: 5, type: 'weekend', cuisine: 'thai', protein: 'tofu', method: 'slow-cook', pantryFocus: ['spinach'] },
  tasteSignals: { recentMealTitles: ['Beef Tacos'], dislikedMealTitles: [], lovedMealTitles: [] },
  pantryItems: ['spinach', 'rice'],
  useSoonItems: ['spinach'],
};
const recipe = { id: 'ai-tofu-1234abcd', title: 'Tofu Massaman', ingredients: [], tags: [] };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => vi.restoreAllMocks());

describe('generateDay (#95)', () => {
  it('asks for one recipe for the slot\'s day, with the slot, taste and pantry', async () => {
    const fetchImpl = vi.fn(async () => json({ recipes: [recipe], explanations: { [recipe.id]: 'Uses your spinach first.' } }));
    const result = await generateDay(request, fetchImpl as unknown as typeof fetch);
    expect(result).toEqual({ ok: true, recipe, explanation: 'Uses your spinach first.' });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/generate-recipes');
    expect(JSON.parse(init.body as string)).toMatchObject({
      numberOfRecipes: 1,
      specificDays: [{ index: 5, type: 'weekend' }],
      slot: { cuisine: 'thai', protein: 'tofu', method: 'slow-cook', pantryFocus: ['spinach'] },
      recentMealTitles: ['Beef Tacos'],
      pantryItems: ['spinach', 'rice'],
      useSoonItems: ['spinach'],
    });
  });

  it('returns the route\'s friendly error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => json({ error: 'That took too long. Please try again.', code: 'timeout' }, 504));
    expect(await generateDay(request, fetchImpl as unknown as typeof fetch)).toEqual({
      ok: false,
      error: 'That took too long. Please try again.',
    });
  });

  it.each([
    ['a network failure', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['a non-JSON body', async () => new Response('<html>504</html>', { status: 504 })],
    ['a success with no recipe', async () => json({ recipes: [] })],
  ])('returns generic copy for %s', async (_label, impl) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await generateDay(request, vi.fn(impl) as unknown as typeof fetch)).toEqual({ ok: false, error: GENERIC_ERROR_MESSAGE });
  });

  it('flags a 401 as redirected to login', async () => {
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {});
    const result = await generateDay(request, vi.fn(async () => json({ code: 'unauthenticated' }, 401)) as unknown as typeof fetch);
    expect(result).toMatchObject({ ok: false, redirected: true });
    expect(assign).toHaveBeenCalled();
  });
});
