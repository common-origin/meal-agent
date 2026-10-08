/**
 * Per-task AI configuration (#83). The only place model IDs appear: change
 * a model or provider here, not in a route.
 *
 * Deadlines cover the whole call including the SDK's retries; each AI
 * route's `maxDuration` must stay above its task's deadline (a test checks
 * this). Temperature is left at the model default, per Google's Gemini 3
 * guidance; #86 can revisit sampling with evidence.
 */

// Not every model accepts every level: gemini-3.8-flash rejects 'minimal'
// with a 400 (checked 2026-10-08), so change the level with the model.
export type ThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';

export interface AiTaskConfig {
  model: string;
  thinkingLevel: ThinkingLevel;
  deadlineMs: number;
  maxOutputTokens: number;
}

export const AI_TASKS = {
  generation: { model: 'gemini-3.8-flash', thinkingLevel: 'low', deadlineMs: 60_000, maxOutputTokens: 16_000 },
  recipeFromImage: { model: 'gemini-3.8-flash', thinkingLevel: 'low', deadlineMs: 45_000, maxOutputTokens: 8_000 },
  pantryScan: { model: 'gemini-3.5-flash-lite', thinkingLevel: 'minimal', deadlineMs: 30_000, maxOutputTokens: 2_000 },
  recipeFromUrl: { model: 'gemini-3.5-flash-lite', thinkingLevel: 'minimal', deadlineMs: 30_000, maxOutputTokens: 8_000 },
} as const satisfies Record<string, AiTaskConfig>;

export type AiTask = keyof typeof AI_TASKS;

export interface ModelRate {
  /** USD per 1M input tokens (text and image are billed alike). */
  inputPerM: number;
  /** USD per 1M output tokens, thinking included. */
  outputPerM: number;
  /** First UTC day these rates apply (inclusive). Omit for "always". */
  effectiveFrom?: string;
}

/**
 * Paid-tier standard pricing per model, oldest first; the latest entry
 * already in effect wins. From https://ai.google.dev/gemini-api/docs/pricing
 * (checked 2026-10-07). Update when models or prices change; a model
 * missing here records a null cost rather than a guess.
 */
export const MODEL_PRICING: Record<string, ModelRate[]> = {
  'gemini-3.8-flash': [
    { inputPerM: 0.75, outputPerM: 3.75 },
    { effectiveFrom: '2027-01-01', inputPerM: 1.5, outputPerM: 7.5 },
  ],
  'gemini-3.5-flash-lite': [{ inputPerM: 0.3, outputPerM: 2.5 }],
};
