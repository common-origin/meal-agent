/**
 * Records a failure in app_errors (admin dashboard, #244). Server only.
 *
 * Telemetry never breaks a request: every write is best-effort, a failure
 * (including the table not existing yet, since migrations are run by hand)
 * only warns, and nothing here throws.
 *
 * - `reportErrorAfterResponse()` for route handlers: the write runs after the
 *   response, via `after()`.
 * - `await reportErrorNow()` for `onRequestError` in instrumentation.ts: Next
 *   requires that work to be awaited, and `after()` isn't available there.
 */

import { runAfterResponse } from '@/lib/adminAlerts';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { AiTaskError } from '@/lib/ai/run';
import { buildErrorRow, type AppErrorRow, type ErrorReport } from './errorRow';

/** True for errors that runAiTask already records in ai_usage, so they must not be counted twice. */
export function isAlreadyRecorded(error: unknown): boolean {
  return error instanceof AiTaskError;
}

function logLine(row: AppErrorRow): void {
  // household_id is left out of the log: it's on the row, as with ai_call lines.
  console.error(JSON.stringify({ type: 'app_error', ...row, household_id: undefined }));
}

async function insertRow(row: AppErrorRow): Promise<void> {
  try {
    const { error } = await createAdminClient().from('app_errors').insert(row);
    if (error) console.warn('app_errors insert failed (is migration 019 applied?):', error.message);
  } catch (e) {
    console.warn('app_errors insert failed:', e instanceof Error ? e.message : String(e));
  }
}

/** The signed-in user's household, from the session cookie; null when there is none. */
async function sessionHousehold(): Promise<string | null> {
  try {
    const { data } = await (await createClient()).rpc('get_user_household_id');
    return typeof data === 'string' ? data : null;
  } catch {
    return null;
  }
}

export async function reportErrorNow(report: ErrorReport): Promise<void> {
  if (isAlreadyRecorded(report.error)) return;
  try {
    const row = buildErrorRow(report);
    logLine(row);
    await insertRow(row);
  } catch (e) {
    console.warn('reportErrorNow failed:', e instanceof Error ? e.message : String(e));
  }
}

/**
 * For a caught error in a route handler. Skips errors runAiTask already
 * recorded. When no `householdId` is given, the signed-in user's household is
 * looked up after the response (route handlers can read cookies in `after()`).
 */
export function reportErrorAfterResponse(report: ErrorReport): void {
  if (isAlreadyRecorded(report.error)) return;
  let row: AppErrorRow;
  try {
    row = buildErrorRow(report);
  } catch (e) {
    console.warn('reportErrorAfterResponse failed:', e instanceof Error ? e.message : String(e));
    return;
  }
  logLine(row);
  runAfterResponse(async () => {
    const household_id = row.household_id ?? (await sessionHousehold());
    await insertRow({ ...row, household_id });
  });
}
