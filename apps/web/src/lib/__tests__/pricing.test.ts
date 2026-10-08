import { describe, it, expect } from 'vitest';
import { estimateCostUsd } from '../ai/pricing';

const tokens = (inputTokens: number | null, outputTokens: number | null, thinkingTokens: number | null = null) => ({
  inputTokens,
  outputTokens,
  thinkingTokens,
});

describe('estimateCostUsd', () => {
  it('prices gemini-3.8-flash at the 2026 rates through 31 December', () => {
    // 1M input at $0.75 + 1M output at $3.75
    expect(estimateCostUsd('gemini-3.8-flash', tokens(1_000_000, 1_000_000), new Date('2026-12-31T23:59:59Z'))).toBe(4.5);
  });

  it('switches gemini-3.8-flash to the new rates from 1 January 2027 (UTC)', () => {
    // 1M input at $1.50 + 1M output at $7.50
    expect(estimateCostUsd('gemini-3.8-flash', tokens(1_000_000, 1_000_000), new Date('2027-01-01T00:00:00Z'))).toBe(9);
  });

  it('bills thinking tokens at the output rate', () => {
    // gemini-3.5-flash-lite: 1,000 input at $0.30/M + (500 output + 2,000 thinking) at $2.50/M
    expect(estimateCostUsd('gemini-3.5-flash-lite', tokens(1_000, 500, 2_000))).toBeCloseTo(0.0003 + 0.00625, 9);
    expect(estimateCostUsd('gemini-3.5-flash-lite', tokens(1_000, 500, 2_000))).toBeGreaterThan(
      estimateCostUsd('gemini-3.5-flash-lite', tokens(1_000, 500)) as number
    );
  });

  it('treats missing thinking tokens as zero', () => {
    expect(estimateCostUsd('gemini-3.5-flash-lite', tokens(1_000_000, 0, null))).toBe(0.3);
  });

  it('prices gemini-3.5-flash-lite', () => {
    expect(estimateCostUsd('gemini-3.5-flash-lite', tokens(1_000_000, 1_000_000))).toBe(2.8);
  });

  it('returns null for an unknown or retired model rather than guessing', () => {
    expect(estimateCostUsd('gemini-9-ultra', tokens(1_000, 1_000))).toBeNull();
    expect(estimateCostUsd('gemini-2.5-pro', tokens(1_000, 1_000))).toBeNull();
  });

  it('returns null when input or output tokens are unknown', () => {
    expect(estimateCostUsd('gemini-3.5-flash-lite', tokens(null, 100))).toBeNull();
    expect(estimateCostUsd('gemini-3.5-flash-lite', tokens(100, null))).toBeNull();
  });

  it('rounds to the six decimal places ai_usage.cost_usd stores', () => {
    // 1 input token on gemini-3.5-flash-lite = $0.0000003, below a micro-dollar
    expect(estimateCostUsd('gemini-3.5-flash-lite', tokens(1, 0))).toBe(0);
    expect(estimateCostUsd('gemini-3.5-flash-lite', tokens(7, 3))).toBe(0.00001);
  });
});
