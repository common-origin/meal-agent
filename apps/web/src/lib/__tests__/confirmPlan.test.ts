import { describe, it, expect, vi } from 'vitest';
import { confirmPlan } from '../client/confirmPlan';

const deps = (pendingSaves: Promise<unknown> = Promise.resolve()) => ({
  pendingSaves,
  markConfirmed: vi.fn(),
  track: vi.fn(),
  navigate: vi.fn(),
});

describe('confirmPlan (#38)', () => {
  it('confirms the recipes, records it, then opens the shopping list', async () => {
    const d = deps();
    await expect(confirmPlan(['a', 'b'], 118, d)).resolves.toBe(true);
    expect(d.markConfirmed).toHaveBeenCalledWith(['a', 'b']);
    expect(d.track).toHaveBeenCalledWith({ finalCost: 118, dayCount: 2 });
    expect(d.navigate).toHaveBeenCalledWith('/shopping-list');
  });

  it('waits for a plan save still in flight before confirming or navigating', async () => {
    let finishSave!: () => void;
    const d = deps(new Promise<void>((resolve) => (finishSave = resolve)));
    const result = confirmPlan(['a'], 20, d);
    await Promise.resolve();
    expect(d.markConfirmed).not.toHaveBeenCalled();
    expect(d.navigate).not.toHaveBeenCalled();
    finishSave();
    await result;
    expect(d.navigate).toHaveBeenCalledWith('/shopping-list');
  });

  it('still confirms if that save failed (the saver already logged it)', async () => {
    const d = deps(Promise.reject(new Error('offline')));
    await expect(confirmPlan(['a'], 20, d)).resolves.toBe(true);
    expect(d.navigate).toHaveBeenCalled();
  });

  it('does nothing for an empty plan', async () => {
    const d = deps();
    await expect(confirmPlan([], 0, d)).resolves.toBe(false);
    expect(d.markConfirmed).not.toHaveBeenCalled();
    expect(d.navigate).not.toHaveBeenCalled();
  });
});
