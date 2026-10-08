/**
 * Estimated Gemini API cost per call (#85).
 *
 * USD per 1M tokens, paid tier, standard (not batch) pricing, from
 * https://ai.google.dev/gemini-api/docs/pricing (page last updated
 * 2026-10-07; the #85 rates were taken 2026-09-26 and still match).
 * Thinking tokens are billed as output. Image input is billed at the text
 * input rate for all of these models. Update this table when models or
 * prices change; an unknown model gives a null cost rather than a guess.
 */

interface Rate {
  inputPerM: number;
  outputPerM: number;
}

interface ModelPricing extends Rate {
  /** First UTC day these rates apply (inclusive). Omit for "always". */
  effectiveFrom?: string;
  /** Higher rates once the prompt exceeds this many input tokens. */
  longContext?: Rate & { aboveInputTokens: number };
}

/** Rates per model, oldest first. The latest entry already in effect wins. */
export const MODEL_PRICING: Record<string, ModelPricing[]> = {
  'gemini-2.5-pro': [
    {
      inputPerM: 1.25,
      outputPerM: 10.0,
      longContext: { aboveInputTokens: 200_000, inputPerM: 2.5, outputPerM: 15.0 },
    },
  ],
  'gemini-2.5-flash': [{ inputPerM: 0.3, outputPerM: 2.5 }],
  'gemini-3.8-flash': [
    { inputPerM: 0.75, outputPerM: 3.75 },
    { effectiveFrom: '2027-01-01', inputPerM: 1.5, outputPerM: 7.5 },
  ],
  'gemini-3.5-flash-lite': [{ inputPerM: 0.3, outputPerM: 2.5 }],
};

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
  const pricing = ratesAt(model, at);
  if (!pricing || usage.inputTokens === null || usage.outputTokens === null) return null;

  const long = pricing.longContext;
  const rate: Rate = long && usage.inputTokens > long.aboveInputTokens ? long : pricing;
  const billedOutput = usage.outputTokens + (usage.thinkingTokens ?? 0);
  const cost = (usage.inputTokens * rate.inputPerM + billedOutput * rate.outputPerM) / 1_000_000;
  // Matches the ai_usage.cost_usd column, numeric(10,6).
  return Math.round(cost * 1e6) / 1e6;
}

function ratesAt(model: string, at: Date): ModelPricing | undefined {
  const today = at.toISOString().slice(0, 10);
  const entries = MODEL_PRICING[model] ?? [];
  return entries.filter((entry) => !entry.effectiveFrom || entry.effectiveFrom <= today).at(-1);
}
