import { describe, it, expect } from 'vitest';
import { acceptPreview, changeCount, isPreviewPending, proposeEdits, resolveNight, retryNight } from '../planEdit';
import type { MealCardProps } from '@/components/app/MealCard';

const meal = (id: string): MealCardProps => ({ recipeId: id, title: id, chef: '', timeMins: 30 });
const plan = [meal('mon'), meal('tue'), null, meal('thu'), meal('fri'), meal('sat'), meal('sun')];

describe('plan edit preview (#38)', () => {
  it('proposes replaced nights as loading and removals as remove', () => {
    const preview = proposeEdits(null, [{ day: 1, action: 'replace', guidance: 'lighter' }, { day: 3, action: 'remove' }], 1);
    expect(preview.nights).toEqual({
      1: { kind: 'replace', guidance: 'lighter', status: 'loading', token: 1 },
      3: { kind: 'remove' },
    });
    expect(isPreviewPending(preview)).toBe(true);
  });

  it('merges a follow-up into the open preview, re-proposing the nights it names', () => {
    let preview = proposeEdits(null, [{ day: 1, action: 'replace', guidance: 'lighter' }, { day: 3, action: 'remove' }], 1);
    preview = resolveNight(preview, 1, 1, { ok: true, meal: meal('salad') })!;
    preview = proposeEdits(preview, [{ day: 1, action: 'replace', guidance: 'with fish' }], 2);
    expect(preview.nights[1]).toEqual({ kind: 'replace', guidance: 'with fish', status: 'loading', token: 2 });
    expect(preview.nights[3]).toEqual({ kind: 'remove' });
  });

  it('only lands a result for the request the night is waiting on', () => {
    const preview = proposeEdits(null, [{ day: 1, action: 'replace' }], 2);
    expect(resolveNight(preview, 1, 1, { ok: true, meal: meal('stale') })).toBe(preview);
    expect(resolveNight(null, 1, 2, { ok: true, meal: meal('discarded') })).toBeNull();
    const ready = resolveNight(preview, 1, 2, { ok: true, meal: meal('fresh') })!;
    expect(ready.nights[1]).toMatchObject({ status: 'ready', meal: { recipeId: 'fresh' } });
    // Once resolved, a duplicate result for the same request is ignored too.
    expect(resolveNight(ready, 1, 2, { ok: true, meal: meal('again') })).toBe(ready);
  });

  it('records a failure, and retries it under a new token', () => {
    let preview = proposeEdits(null, [{ day: 4, action: 'replace', guidance: 'quick' }], 1);
    preview = resolveNight(preview, 4, 1, { ok: false, error: 'That took too long. Please try again.' })!;
    expect(preview.nights[4]).toMatchObject({ status: 'failed', error: 'That took too long. Please try again.' });
    expect(isPreviewPending(preview)).toBe(false);
    preview = retryNight(preview, 4, 7);
    expect(preview.nights[4]).toEqual({ kind: 'replace', guidance: 'quick', status: 'loading', token: 7 });
  });

  it('accepts ready meals and removals, keeping the original where a night failed or is still loading', () => {
    let preview = proposeEdits(
      null,
      [
        { day: 0, action: 'replace' },
        { day: 1, action: 'replace' },
        { day: 2, action: 'replace' },
        { day: 6, action: 'remove' },
      ],
      1
    );
    preview = resolveNight(preview, 0, 1, { ok: true, meal: meal('new-mon') })!;
    preview = resolveNight(preview, 2, 1, { ok: true, meal: meal('new-wed') })!;
    preview = resolveNight(preview, 1, 1, { ok: false, error: 'x' })!;

    const { plan: next, newIds } = acceptPreview(plan, preview);
    expect(next.map((m) => m?.recipeId ?? null)).toEqual(['new-mon', 'tue', 'new-wed', 'thu', 'fri', 'sat', null]);
    expect(newIds).toEqual(['new-mon', 'new-wed']);
    expect(changeCount(preview)).toBe(3);
    expect(plan[0]?.recipeId).toBe('mon'); // the original plan is untouched
  });

  it('counts nothing for no preview', () => {
    expect(changeCount(null)).toBe(0);
    expect(isPreviewPending(null)).toBe(false);
  });
});
