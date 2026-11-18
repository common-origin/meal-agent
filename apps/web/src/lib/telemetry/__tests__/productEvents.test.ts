import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { eventBatchSchema, serverEventSchema, MAX_EVENTS_PER_BATCH } from '../productEvents';
import { toServerEvent, enqueueServerEvent, flushServerEvents, clearServerEventQueue } from '../productEventsClient';
import { track, setOptOut } from '@/lib/analytics';

const WEEK = '2026-11-16';

describe('toServerEvent (#247)', () => {
  it('maps plan_composed to its five allowed props, dropping cost, conflicts and leftoverDays', () => {
    const event = toServerEvent('plan_composed', {
      dayCount: 5,
      pantryItemCount: 12,
      cuisineCount: 3,
      proteinVariety: 4,
      weekStart: WEEK,
      cost: 123.4,
      conflicts: 0,
      leftoverDays: 0,
      recipeId: 'ai-lemon-chicken',
    });
    expect(event).toEqual({ type: 'plan_composed', props: { dayCount: 5, pantryItemCount: 12, cuisineCount: 3, proteinVariety: 4, weekStart: WEEK } });
  });

  it.each([
    ['plan_confirmed', { weekStart: WEEK, finalCost: 90, dayCount: 5 }, { weekStart: WEEK }],
    ['plan_edit', { nights: 2, followUp: true }, { nights: 2 }],
    ['plan_edit_accepted', { nights: 3 }, { nights: 3 }],
    ['shopping_list_built', { weekStart: WEEK, itemCount: 40 }, { weekStart: WEEK, itemCount: 40 }],
    ['coles_list_sent', { weekStart: WEEK, itemCount: 38 }, { weekStart: WEEK, itemCount: 38 }],
    ['shopping_completed', { weekStart: WEEK, itemCount: 40 }, { weekStart: WEEK }],
    ['recipe_rated', { stars: 4, recipeId: 'x', title: 'Butter Chicken' }, { stars: 4 }],
    ['export_csv', { itemCount: 40 }, {}],
    ['favorite_added', { recipeId: 'ai-lemon-chicken' }, {}],
    ['favorite_removed', { recipeId: 'ai-lemon-chicken' }, {}],
    ['price_reported', { ingredient: 'milk', price: 2.5, location: 'Bondi' }, {}],
    ['recipe_emailed', { recipeId: 'x', recipientCount: 2 }, {}],
  ] as const)('%s keeps only its allowed props', (type, meta, props) => {
    expect(toServerEvent(type, meta)).toEqual({ type, props });
  });

  it('derives the swap kind: delete, add, or swap', () => {
    const base = { day: 'Mon', oldRecipeId: 'a-b', newRecipeId: 'c-d' };
    expect(toServerEvent('swap', { ...base, newRecipeId: 'deleted' })).toEqual({ type: 'swap', props: { kind: 'delete' } });
    expect(toServerEvent('swap', { ...base, oldRecipeId: 'none', action: 'add' })).toEqual({ type: 'swap', props: { kind: 'add' } });
    expect(toServerEvent('swap', { ...base, action: 'swap' })).toEqual({ type: 'swap', props: { kind: 'swap' } });
  });

  it("doesn't send post-generation fills (oldRecipeId 'empty')", () => {
    expect(toServerEvent('swap', { day: 'Mon', oldRecipeId: 'empty', newRecipeId: 'ai-x-y-z' })).toBeNull();
  });

  it('never sends a recipe id: swap props are only the kind', () => {
    const event = toServerEvent('swap', { oldRecipeId: 'jamie-oliver-lemon-chicken', newRecipeId: 'ai-quick-skillet', action: 'swap' });
    expect(JSON.stringify(event)).not.toMatch(/jamie|skillet|ai-quick/);
  });

  it.each(['page_view', 'plan_regenerated', 'plan_reviewed', 'swap_suggested', 'meal_reordered', 'ingredient_reused', 'cost_optimized', 'override_saved'] as const)(
    'does not send %s, which is not whitelisted',
    (type) => {
      expect(toServerEvent(type, { page: '/plan', weekStart: WEEK })).toBeNull();
    }
  );

  it('drops an event whose required props are missing or invalid', () => {
    expect(toServerEvent('plan_confirmed', {})).toBeNull();
    expect(toServerEvent('plan_confirmed', { weekStart: 'next tuesday' })).toBeNull();
    expect(toServerEvent('plan_confirmed', { weekStart: '2026-13-45' })).toBeNull();
    expect(toServerEvent('recipe_rated', { stars: 6 })).toBeNull();
    expect(toServerEvent('plan_edit', { nights: 'two' })).toBeNull();
  });
});

describe('serverEventSchema (the server-side whitelist)', () => {
  it('rejects unknown keys and free-text strings', () => {
    expect(serverEventSchema.safeParse({ type: 'plan_confirmed', props: { weekStart: WEEK, recipeId: 'ai-lemon-chicken' } }).success).toBe(false);
    expect(serverEventSchema.safeParse({ type: 'swap', props: { kind: 'swap', title: 'Butter Chicken' } }).success).toBe(false);
    expect(serverEventSchema.safeParse({ type: 'swap', props: { kind: 'Butter Chicken' } }).success).toBe(false);
    expect(serverEventSchema.safeParse({ type: 'favorite_added', props: { recipeId: 'ai-lemon-chicken' } }).success).toBe(false);
    expect(serverEventSchema.safeParse({ type: 'plan_confirmed', props: { weekStart: 'jane@example.com' } }).success).toBe(false);
    expect(serverEventSchema.safeParse({ type: 'plan_confirmed', props: { weekStart: WEEK }, userId: 'u1' }).success).toBe(false);
    expect(serverEventSchema.safeParse({ type: 'page_view', props: {} }).success).toBe(false);
    expect(serverEventSchema.safeParse({ type: 'plan_composed', props: { dayCount: 5, weekStart: WEEK } }).success).toBe(false);
  });

  it('accepts each whitelisted shape and caps a batch at 20 events', () => {
    const one = { type: 'export_csv', props: {} };
    expect(eventBatchSchema.safeParse({ events: [one] }).success).toBe(true);
    expect(eventBatchSchema.safeParse({ events: Array(MAX_EVENTS_PER_BATCH).fill(one) }).success).toBe(true);
    expect(eventBatchSchema.safeParse({ events: Array(MAX_EVENTS_PER_BATCH + 1).fill(one) }).success).toBe(false);
    expect(eventBatchSchema.safeParse({ events: [] }).success).toBe(false);
  });
});

describe('queue and opt-out', () => {
  const beacon = vi.fn();
  const fetchMock = vi.fn();
  const sent = () => [...beacon.mock.calls, ...fetchMock.mock.calls].length;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    clearServerEventQueue();
    beacon.mockReset().mockReturnValue(true);
    fetchMock.mockReset().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const bodyOf = async (call: unknown[]) => JSON.parse(await (call[1] as Blob).text());

  it('batches events and flushes after the debounce through sendBeacon', async () => {
    track('export_csv', { itemCount: 3 });
    track('plan_confirmed', { weekStart: WEEK, finalCost: 50, dayCount: 5 });
    expect(sent()).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(beacon.mock.calls[0][0]).toBe('/api/telemetry/events');
    expect(await bodyOf(beacon.mock.calls[0])).toEqual({
      events: [
        { type: 'export_csv', props: {} },
        { type: 'plan_confirmed', props: { weekStart: WEEK } },
      ],
    });
  });

  it('falls back to fetch with keepalive when sendBeacon refuses', () => {
    beacon.mockReturnValue(false);
    track('export_csv');
    vi.advanceTimersByTime(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', keepalive: true });
  });

  it('flushes on pagehide', () => {
    track('favorite_added', { recipeId: 'ai-lemon-chicken' });
    window.dispatchEvent(new Event('pagehide'));
    expect(beacon).toHaveBeenCalledTimes(1);
  });

  it('splits more than 20 queued events into batches the server accepts', async () => {
    for (let i = 0; i < 45; i++) enqueueServerEvent({ type: 'export_csv', props: {} });
    flushServerEvents();
    const sizes = await Promise.all(beacon.mock.calls.map(async (c) => (await bodyOf(c)).events.length));
    expect(sizes.every((n) => n <= MAX_EVENTS_PER_BATCH)).toBe(true);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(45);
  });

  it('keeps writing to localStorage as before', () => {
    track('export_csv', { itemCount: 3 });
    expect(JSON.parse(localStorage.getItem('ma_analytics') ?? '[]')).toHaveLength(1);
  });

  it('does not send post-generation fills or non-whitelisted events', () => {
    track('swap', { day: 'Mon', oldRecipeId: 'empty', newRecipeId: 'ai-x-y' });
    track('page_view', { page: '/plan' });
    vi.advanceTimersByTime(5000);
    expect(sent()).toBe(0);
  });

  it('opting out stops server events, including ones already queued', () => {
    track('export_csv');
    setOptOut(true);
    track('export_csv');
    vi.advanceTimersByTime(5000);
    window.dispatchEvent(new Event('pagehide'));
    expect(sent()).toBe(0);
    // Only the event tracked before opting out was recorded locally; the one after was not.
    expect(JSON.parse(localStorage.getItem('ma_analytics') ?? '[]')).toHaveLength(1);
  });

  it('an opt-out made in another tab also stops what this tab queued', () => {
    track('export_csv');
    localStorage.setItem('ma_analytics_optout', 'true');
    vi.advanceTimersByTime(5000);
    expect(sent()).toBe(0);
  });
});
