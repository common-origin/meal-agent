/**
 * AI usage logging and the per-user daily AI cap (#85).
 *
 * Every AI call goes through `trackedAiCall`, which runs it under its
 * deadline (#81) and records one row in `ai_usage` plus one structured log
 * line: task, model, tokens, estimated cost, latency and outcome. The row is
 * written after the response is sent (Next's `after()`), and a failed write
 * is only warned about: logging never fails a request.
 *
 * This sits on the legacy Gemini SDK for now; #83's `runAiTask` takes it
 * over. Until #84 centralises response parsing, a call is recorded by its
 * API outcome, so `invalid_output` isn't produced yet.
 */

import { after } from 'next/server';
import type { GenerateContentResult, UsageMetadata } from '@google/generative-ai';
import { createClient } from '@/lib/supabase/server';
import { callWithDeadline, isTimeoutError } from '@/lib/api/aiCall';
import { estimateCostUsd, type TokenUsage } from './pricing';

export type AiTask = 'generate-recipes' | 'scan-pantry-image' | 'extract-recipe-from-image' | 'extract-recipe-from-url';

export type AiCallStatus = 'ok' | 'error' | 'timeout' | 'blocked' | 'invalid_output' | 'rate_limited';

/** AI calls allowed per user per UTC day, counted from ai_usage. */
export const DAILY_AI_CALL_CAP = 100;

export interface AiCallContext {
  task: AiTask;
  model: string;
  userId: string;
}

// Responses withheld by Gemini's own filters rather than failures.
const BLOCKED_FINISH_REASONS = new Set(['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII']);

/**
 * Runs a Gemini call with `callWithDeadline` and records its usage. Returns
 * or throws exactly what the call does.
 */
export async function trackedAiCall(
  context: AiCallContext,
  deadlineMs: number,
  call: (signal: AbortSignal) => Promise<GenerateContentResult>
): Promise<GenerateContentResult> {
  const startedAt = Date.now();
  try {
    const result = await callWithDeadline(deadlineMs, call);
    const blockedReason = blockReason(result);
    recordAiUsage(context, {
      latencyMs: Date.now() - startedAt,
      status: blockedReason ? 'blocked' : 'ok',
      errorCode: blockedReason,
      tokens: tokenUsage(result.response.usageMetadata),
    });
    return result;
  } catch (error) {
    const { status, errorCode } = classifyError(error);
    recordAiUsage(context, {
      latencyMs: Date.now() - startedAt,
      status,
      errorCode,
      tokens: { inputTokens: null, outputTokens: null, thinkingTokens: null },
    });
    throw error;
  }
}

interface AiCallOutcome {
  latencyMs: number;
  status: AiCallStatus;
  errorCode: string | null;
  tokens: TokenUsage;
}

/**
 * Logs one `ai_call` line now, and inserts the ai_usage row after the
 * response. The row's household_id is filled in by the database
 * (column default get_user_household_id()), so it's on the row but not in
 * the log line.
 */
export function recordAiUsage(context: AiCallContext, outcome: AiCallOutcome): void {
  const row = {
    user_id: context.userId,
    task: context.task,
    model: context.model,
    input_tokens: outcome.tokens.inputTokens,
    output_tokens: outcome.tokens.outputTokens,
    thinking_tokens: outcome.tokens.thinkingTokens,
    cost_usd: estimateCostUsd(context.model, outcome.tokens),
    latency_ms: outcome.latencyMs,
    status: outcome.status,
    error_code: outcome.errorCode,
  };
  console.info(JSON.stringify({ type: 'ai_call', ...row }));

  runAfterResponse(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from('ai_usage').insert(row);
    if (error) console.warn('ai_usage: could not record AI call (is migration 010 applied?)', error.message);
  });
}

/**
 * True when the user has already made DAILY_AI_CALL_CAP AI calls since UTC
 * midnight. Fails open: if the count can't be read (e.g. the migration
 * hasn't run), the call is allowed and a warning is logged.
 *
 * The cap is approximate: rows are written after each response, so requests
 * made at the same moment see the same count. The per-route burst limiter
 * bounds how far that can overshoot.
 */
export async function isOverDailyAiCap(userId: string, now: Date = new Date()): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startOfUtcDay(now));
    if (error) throw error;
    return (count ?? 0) >= DAILY_AI_CALL_CAP;
  } catch (error) {
    console.warn('ai_usage: daily AI cap check failed, allowing the call', error);
    return false;
  }
}

export function startOfUtcDay(now: Date): string {
  return `${now.toISOString().slice(0, 10)}T00:00:00.000Z`;
}

function tokenUsage(meta: UsageMetadata | undefined): TokenUsage {
  // The API also returns thoughtsTokenCount for thinking models; the legacy
  // SDK's type just doesn't declare it.
  const usage = meta as (UsageMetadata & { thoughtsTokenCount?: number }) | undefined;
  return {
    inputTokens: usage?.promptTokenCount ?? null,
    outputTokens: usage?.candidatesTokenCount ?? null,
    thinkingTokens: usage?.thoughtsTokenCount ?? null,
  };
}

function blockReason(result: GenerateContentResult): string | null {
  const promptBlock = result.response.promptFeedback?.blockReason;
  if (promptBlock) return String(promptBlock);
  const finishReason = result.response.candidates?.[0]?.finishReason;
  return finishReason && BLOCKED_FINISH_REASONS.has(finishReason) ? finishReason : null;
}

function classifyError(error: unknown): { status: AiCallStatus; errorCode: string } {
  if (isTimeoutError(error)) return { status: 'timeout', errorCode: 'timeout' };
  const httpStatus = (error as { status?: unknown } | null)?.status;
  if (typeof httpStatus === 'number') {
    return { status: httpStatus === 429 ? 'rate_limited' : 'error', errorCode: `http_${httpStatus}` };
  }
  return { status: 'error', errorCode: error instanceof Error ? error.name : 'unknown' };
}

/**
 * `after()` only works inside a request; elsewhere (scripts, tests) run the
 * work in the background instead. Failures are warned about, never thrown.
 */
function runAfterResponse(work: () => Promise<void>): void {
  const safeWork = () =>
    work().catch((error) => console.warn('ai_usage: could not record AI call', error));
  try {
    after(safeWork);
  } catch {
    void safeWork();
  }
}
