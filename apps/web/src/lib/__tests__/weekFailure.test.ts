import { describe, it, expect } from 'vitest';
import { WEEK_FAILED_MESSAGE, weekFailure } from '../client/generateDay';

const CREDITS = "AI features aren't available right now. Please try again later.";

describe('weekFailure (#171)', () => {
  it('reports one shared reason once, folding the nights into it', () => {
    expect(weekFailure(Array(7).fill(CREDITS))).toEqual({ message: CREDITS, foldNightErrors: true });
  });

  it('keeps per-night errors under a general alert when the reasons differ', () => {
    expect(weekFailure([CREDITS, 'That took too long. Please try again.'])).toEqual({
      message: WEEK_FAILED_MESSAGE,
      foldNightErrors: false,
    });
  });

  it('falls back to the general alert when no night recorded a reason', () => {
    expect(weekFailure([])).toEqual({ message: WEEK_FAILED_MESSAGE, foldNightErrors: false });
  });
});
