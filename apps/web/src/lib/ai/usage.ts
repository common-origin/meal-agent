/**
 * AI usage logging and the per-user daily AI cap (#85).
 *
 * `runAiTask` (run.ts) records every AI call through `recordAiUsage`: one
 * structured log line plus one `ai_usage` row with task, model, tokens,
 * estimated cost, latency and outcome. The row is written after the
 * response is sent (Next's `after()`), and a failed write is only warned
 * about: logging never fails a request. Until #84 centralises response
 * parsing, `invalid_output` isn't produced.
 */

import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { estimateCostUsd, type TokenUsage } from './pricing';
import type { AiTask } from './models';

export type AiCallStatus = 'ok' | 'error' | 'timeout' | 'blocked' | 'invalid_output' | 'rate_limited';

/** AI calls allowed per user per UTC day, counted from ai_usage. */
export const DAILY_AI_CALL_CAP = 100;

export interface AiCallContext {
  task: AiTask;
  model: string;
  userId: string;
}

export interface AiCallOutcome {
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
