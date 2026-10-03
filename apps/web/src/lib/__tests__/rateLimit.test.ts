import { describe, it, expect } from 'vitest';
import { createRateLimiter } from '../api/rateLimit';

function fakeClock(start = 0) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe('createRateLimiter', () => {
  it('allows up to the limit within the window, then blocks', () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({ limit: 3, windowMs: 1000, now: clock.now });
    expect([limiter.check('a'), limiter.check('a'), limiter.check('a')]).toEqual([true, true, true]);
    expect(limiter.check('a')).toBe(false);
  });

  it('counts each key separately', () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: clock.now });
    expect(limiter.check('a')).toBe(true);
    expect(limiter.check('b')).toBe(true);
    expect(limiter.check('a')).toBe(false);
  });

  it('slides: frees one slot as each request ages out of the window', () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000, now: clock.now });
    limiter.check('a'); // t=0
    clock.advance(600);
    limiter.check('a'); // t=600
    expect(limiter.check('a')).toBe(false);

    clock.advance(400); // t=1000: the t=0 request has aged out
    expect(limiter.check('a')).toBe(true);
    expect(limiter.check('a')).toBe(false);

    clock.advance(600); // t=1600: the t=600 request has aged out
    expect(limiter.check('a')).toBe(true);
  });

  it('does not count blocked requests against the window', () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: clock.now });
    limiter.check('a'); // t=0
    clock.advance(500);
    expect(limiter.check('a')).toBe(false); // t=500, blocked
    clock.advance(500); // t=1000
    expect(limiter.check('a')).toBe(true);
  });

  it('forgets keys once their window has passed, starting them fresh', () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: clock.now });
    limiter.check('a');
    clock.advance(1000);
    limiter.check('b'); // triggers the sweep that drops 'a'
    expect(limiter.check('a')).toBe(true);
    expect(limiter.check('a')).toBe(false);
  });
});
