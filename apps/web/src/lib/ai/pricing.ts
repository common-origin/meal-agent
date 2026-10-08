/**
 * Estimated AI cost per call (#85), from the per-model rates in models.ts.
 * Thinking tokens are billed as output.
 */

import { MODEL_PRICING, type ModelRate } from './models';

export interface TokenUsage {
  inputTokens: number | null;
  /** Output tokens excluding thinking. */
  outputTokens: number | null;
  thinkingTokens: number | null;
}

/**
 * Estimated cost in USD, or null if the model is unknown or the input or
 * output token count is missing. Missing thinking tokens count as zero.
 */
export function estimateCostUsd(model: string, usage: TokenUsage, at: Date = new Date()): number | null {
  const rate = ratesAt(model, at);
  if (!rate || usage.inputTokens === null || usage.outputTokens === null) return null;

  const billedOutput = usage.outputTokens + (usage.thinkingTokens ?? 0);
  const cost = (usage.inputTokens * rate.inputPerM + billedOutput * rate.outputPerM) / 1_000_000;
  // Matches the ai_usage.cost_usd column, numeric(10,6).
  return Math.round(cost * 1e6) / 1e6;
}

function ratesAt(model: string, at: Date): ModelRate | undefined {
  const today = at.toISOString().slice(0, 10);
  const entries = MODEL_PRICING[model] ?? [];
  return entries.filter((entry) => !entry.effectiveFrom || entry.effectiveFrom <= today).at(-1);
}
