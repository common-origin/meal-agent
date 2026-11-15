/**
 * AI usage logging, the per-user daily AI cap (#85) and the daily spend
 * ceiling across all users (#215).
 *
 * `runAiTask` (run.ts) records every AI call through `recordAiUsage`: one
 * structured log line plus one `ai_usage` row with task, model, tokens,
 * estimated cost, latency and outcome. The row is written after the
 * response is sent (Next's `after()`), and a failed write is only warned
 * about: logging never fails a request. Until #84 centralises response
 * parsing, `invalid_output` isn't produced.
 */

import { after } from 'next/server';
import { Resend } from 'resend';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { adminEmails } from '@/lib/auth/admin';
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

/** Estimated AI spend allowed per UTC day across every user, unless AI_DAILY_SPEND_CAP_USD says otherwise. */
export const DEFAULT_DAILY_SPEND_CAP_USD = 5;

/** The day's spend ceiling in USD: AI_DAILY_SPEND_CAP_USD when it's a positive number, else the default. */
export function dailySpendCapUsd(env: Record<string, string | undefined> = process.env): number {
  const configured = Number(env.AI_DAILY_SPEND_CAP_USD);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_DAILY_SPEND_CAP_USD;
}

/**
 * Whether a user may make an AI call now (#215):
 * - `spend_cap`: the estimated spend of every user's calls since UTC
 *   midnight has reached dailySpendCapUsd(), so AI is paused for everyone;
 * - `daily_cap`: this user has made DAILY_AI_CALL_CAP calls today;
 * - `unavailable`: usage couldn't be read, so the call is refused (fails
 *   closed: an unread limit is no limit).
 */
export type AiAllowance = 'ok' | 'daily_cap' | 'spend_cap' | 'unavailable';

/**
 * Both limits are read with the service role, filtered by user explicitly,
 * so they hold in routes with no session (the Coles extension's order
 * matching). They're approximate: rows are written after each response, so
 * calls made at the same moment see the same totals. The per-route burst
 * limiter bounds how far that can overshoot.
 */
export async function checkAiAllowance(userId: string, now: Date = new Date()): Promise<AiAllowance> {
  try {
    const supabase = createAdminClient();
    const since = startOfUtcDay(now);
    const [userCalls, spend] = await Promise.all([
      supabase.from('ai_usage').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since),
      supabase.rpc('ai_spend_since', { since }),
    ]);
    if (userCalls.error) throw userCalls.error;
    if (spend.error) throw spend.error;

    const spentUsd = Number(spend.data ?? 0);
    if (!Number.isFinite(spentUsd)) throw new Error(`ai_spend_since returned ${String(spend.data)}`);
    const capUsd = dailySpendCapUsd();
    if (spentUsd >= capUsd) {
      alertSpendCap(spentUsd, capUsd, now);
      return 'spend_cap';
    }
    return (userCalls.count ?? 0) >= DAILY_AI_CALL_CAP ? 'daily_cap' : 'ok';
  } catch (error) {
    console.error('ai_usage: could not read AI usage, refusing the call (is migration 014 applied?)', error);
    return 'unavailable';
  }
}

/** The UTC day this server instance last alerted on, so the owner gets one email a day, not one per call. */
let lastSpendAlertDay: string | null = null;

/** For tests: forget that today's alert was sent. */
export function resetSpendAlertForTests(): void {
  lastSpendAlertDay = null;
}

/**
 * Logs the ceiling being hit and emails ADMIN_EMAILS through Resend, once
 * per instance per UTC day (several instances may each send one). Sent
 * after the response; a failure is only warned about.
 */
function alertSpendCap(spentUsd: number, capUsd: number, now: Date): void {
  const day = startOfUtcDay(now).slice(0, 10);
  if (lastSpendAlertDay === day) return;
  lastSpendAlertDay = day;

  const summary = `Meal Agent paused AI for today: estimated spend $${spentUsd.toFixed(2)} reached the $${capUsd.toFixed(2)} daily ceiling.`;
  console.error(JSON.stringify({ type: 'ai_spend_cap', day, spentUsd, capUsd }));

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_ADDRESS;
  const to = adminEmails();
  if (!apiKey || !from || to.length === 0) {
    console.warn('ai_usage: spend ceiling reached, but RESEND_API_KEY, RESEND_FROM_ADDRESS or ADMIN_EMAILS is unset, so no email was sent');
    return;
  }
  runAfterResponse(async () => {
    const { error } = await new Resend(apiKey).emails.send({
      from,
      to,
      subject: 'Meal Agent: AI paused for today (spend ceiling reached)',
      text: `${summary}\n\nAI features say "paused for today" until UTC midnight. To change the ceiling, set AI_DAILY_SPEND_CAP_USD in Vercel. The ai_usage table shows what was spent.`,
    });
    if (error) throw new Error(error.message);
  });
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
    work().catch((error) => console.warn('ai_usage: background work failed', error));
  try {
    after(safeWork);
  } catch {
    void safeWork();
  }
}
