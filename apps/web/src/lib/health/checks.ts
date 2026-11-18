/**
 * Dependency health checks (#248). Server only. These run live ONLY from
 * POST /api/health/record (the scheduled workflow); nothing a visitor can
 * reach runs them.
 *
 * Each result is `ok`, a latency, a short static `detail` and a few counts:
 * never a secret, a raw error message or anything personal. A check that
 * throws is reported as failing, never thrown.
 */

import { createAdminClient } from '@/lib/supabase/server';
import { AI_TASKS } from '@/lib/ai/models';
import { BILLING_ERROR_CODES } from '@/lib/ai/run';
import { readColesQuota } from '@/lib/coles/quota';
import { adminEmails } from '@/lib/auth/admin';

export const CHECK_NAMES = ['database', 'gemini', 'coles', 'email', 'config'] as const;
export type CheckName = (typeof CHECK_NAMES)[number];

export interface CheckResult {
  ok: boolean;
  latencyMs: number;
  /** A short static reason, e.g. 'http_403' or 'missing: RAPIDAPI_KEY'. */
  detail?: string;
  /** Counts that explain the result, e.g. quota used and limit. */
  metrics?: Record<string, number>;
}

export interface HealthReport {
  ok: boolean;
  checks: Record<CheckName, CheckResult>;
  totalLatencyMs: number;
}

type Env = Record<string, string | undefined>;

const GEMINI_TIMEOUT_MS = 8_000;
const BILLING_WINDOW_MS = 60 * 60 * 1000;

const missing = (env: Env, names: string[]) => names.filter((name) => !env[name]?.trim());

async function timed(run: () => Promise<Omit<CheckResult, 'latencyMs'>>): Promise<CheckResult> {
  const started = Date.now();
  try {
    return { ...(await run()), latencyMs: Date.now() - started };
  } catch {
    // The raw error stays out of the stored row: it can carry URLs or keys.
    return { ok: false, latencyMs: Date.now() - started, detail: 'threw' };
  }
}

export function checkDatabase(): Promise<CheckResult> {
  return timed(async () => {
    const { error } = await createAdminClient().from('households').select('id').limit(1);
    return error ? { ok: false, detail: 'query_failed' } : { ok: true };
  });
}

/**
 * The Generative Language API's model lookup: free, no tokens. It can't see
 * credit depletion (#171), the likeliest outage, so billing refusals recorded
 * in ai_usage over the last hour also fail the check.
 */
export function checkGemini(env: Env = process.env, now: Date = new Date()): Promise<CheckResult> {
  return timed(async () => {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) return { ok: false, detail: 'missing: GEMINI_API_KEY' };
    const model = AI_TASKS.generation.model;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`, {
      headers: { 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!res.ok) return { ok: false, detail: `http_${res.status}` };

    const since = new Date(now.getTime() - BILLING_WINDOW_MS).toISOString();
    const { count, error } = await createAdminClient()
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'error')
      .in('error_code', [...BILLING_ERROR_CODES])
      .gte('created_at', since);
    if (error) return { ok: true, detail: 'billing_unreadable' };
    if ((count ?? 0) > 0) return { ok: false, detail: 'billing_errors_last_hour', metrics: { billingErrors: count ?? 0 } };
    return { ok: true };
  });
}

/** Configured, and quota left. No RapidAPI call: a lookup costs quota. */
export function checkColes(env: Env = process.env): Promise<CheckResult> {
  return timed(async () => {
    if (!env.RAPIDAPI_KEY?.trim()) return { ok: false, detail: 'missing: RAPIDAPI_KEY' };
    const quota = await readColesQuota();
    if (!quota) return { ok: false, detail: 'quota_unreadable' };
    const metrics = { used: quota.used, limit: quota.limit, remaining: quota.remaining };
    return quota.remaining > 0 ? { ok: true, metrics } : { ok: false, detail: 'quota_used_up', metrics };
  });
}

export function checkEmail(env: Env = process.env): Promise<CheckResult> {
  return timed(async () => {
    const absent = missing(env, ['RESEND_API_KEY', 'RESEND_FROM_ADDRESS']);
    return absent.length ? { ok: false, detail: `missing: ${absent.join(', ')}` } : { ok: true };
  });
}

export function checkConfig(env: Env = process.env): Promise<CheckResult> {
  return timed(async () => {
    const absent = missing(env, ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']);
    if (adminEmails(env).length === 0) absent.push('ADMIN_EMAILS');
    return absent.length ? { ok: false, detail: `missing: ${absent.join(', ')}` } : { ok: true };
  });
}

export async function runHealthChecks(env: Env = process.env): Promise<HealthReport> {
  const started = Date.now();
  const [database, gemini, coles, email, config] = await Promise.all([
    checkDatabase(),
    checkGemini(env),
    checkColes(env),
    checkEmail(env),
    checkConfig(env),
  ]);
  const checks = { database, gemini, coles, email, config };
  return {
    ok: Object.values(checks).every((check) => check.ok),
    checks,
    totalLatencyMs: Date.now() - started,
  };
}
