import { describe, it, expect, vi } from 'vitest';
import { createActivityCounter } from '../activityCounter';

describe('createActivityCounter', () => {
  it('reports active after begin, and inactive after a matching end', () => {
    const onChange = vi.fn();
    const counter = createActivityCounter(onChange);

    counter.begin();
    expect(onChange).toHaveBeenLastCalledWith(true);

    counter.end();
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it('stays active while any overlapping operation is still running', () => {
    // e.g. a swap regeneration kicked off while a full-week generation is
    // still in flight -- the first call finishing shouldn't report
    // inactive while the second is still running.
    const onChange = vi.fn();
    const counter = createActivityCounter(onChange);

    counter.begin();
    counter.begin();
    onChange.mockClear();

    counter.end();
    expect(onChange).not.toHaveBeenCalled(); // still one active, no change to report

    counter.end();
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('does not go negative if end is called more than begin', () => {
    const onChange = vi.fn();
    const counter = createActivityCounter(onChange);

    counter.end();
    counter.end();
    onChange.mockClear();

    counter.begin();
    expect(onChange).toHaveBeenLastCalledWith(true);

    counter.end();
    expect(onChange).toHaveBeenLastCalledWith(false);
  });
});
