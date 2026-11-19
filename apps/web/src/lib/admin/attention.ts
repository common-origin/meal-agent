/**
 * "Needs attention" on /admin: everything the dashboard flags is computed
 * here, from data read when the page is loaded (there are no emails or
 * alerts, #244). Pure: each input is optional, and a rule whose input is
 * missing is skipped (the page then says which checks couldn't run).
 */

import { shortId } from './format';
import type { AiSummary, AttentionItem, ErrorGroup, HealthCheckRow, HouseholdRowRaw, SchemaCheck } from './types';

export const SPIKE_MIN_24H = 5;
export const SPIKE_FACTOR = 3;
export const AI_MIN_CALLS = 10;
export const AI_MIN_SUCCESS_PCT = 90;
export const SPEND_WARN_FRACTION = 0.8;
export const COLES_WARN_FRACTION = 0.8;
const DAY_MS = 86_400_000;

export interface AttentionInput {
  now: Date;
  /** Latest health row, with the staleness and outage flags computed from uptime. */
  health?: { latest: HealthCheckRow | null; heartbeatStale: boolean; outageNow: boolean } | null;
  /** Every error group seen in the last 7 days, across all households. */
  errors7d?: ErrorGroup[] | null;
  /** The last 24 hours of AI calls, across all households. */
  ai24h?: AiSummary | null;
  spend?: { todayUsd: number; capUsd: number } | null;
  coles?: { used: number; limit: number } | null;
  schema?: SchemaCheck[] | null;
  households?: HouseholdRowRaw[] | null;
  /** Names of the inputs that couldn't be read, so their rules didn't run. */
  unavailable?: string[];
}

const describeGroup = (group: ErrorGroup) => group.label ?? `${group.kind} on ${group.route ?? 'an unknown route'}`;

export function computeAttention(input: AttentionInput): AttentionItem[] {
  const items: AttentionItem[] = [];
  const add = (item: AttentionItem) => items.push(item);
  const { now } = input;

  if (input.health) {
    const { latest, heartbeatStale, outageNow } = input.health;
    if (heartbeatStale) {
      add({
        id: 'heartbeat-stale',
        severity: 'error',
        section: 'status',
        message: latest ? 'No health check in the last 30 minutes (is the Uptime workflow running?)' : 'No health check has been recorded yet',
      });
    }
    if (latest && !latest.ok) {
      const failing = Object.entries(latest.checks ?? {})
        .filter(([, check]) => !check.ok)
        .map(([name]) => name);
      add({ id: 'health-failing', severity: 'error', section: 'status', message: `The latest health check is failing${failing.length ? `: ${failing.join(', ')}` : ''}` });
    }
    if (outageNow) {
      add({ id: 'outage-now', severity: 'error', section: 'status', message: 'Possible outage: two or more consecutive health-check slots with no heartbeat' });
    }
  }

  if (input.errors7d) {
    const fresh = input.errors7d.filter((group) => now.getTime() - new Date(group.first_seen).getTime() < DAY_MS);
    if (fresh.length > 0) {
      const names = fresh.slice(0, 3).map(describeGroup).join('; ');
      add({
        id: 'new-errors',
        severity: 'warning',
        section: 'errors',
        message: `${fresh.length} new error${fresh.length === 1 ? '' : 's'} in the last 24 hours: ${names}${fresh.length > 3 ? '…' : ''}`,
      });
    }
    for (const group of input.errors7d) {
      if (group.count_24h >= SPIKE_MIN_24H && group.count_24h > SPIKE_FACTOR * (group.count_7d / 7)) {
        add({
          id: `spike-${group.fingerprint}`,
          severity: 'warning',
          section: 'errors',
          message: `Error spike: ${describeGroup(group)} happened ${group.count_24h} times in 24 hours (7-day average ${(group.count_7d / 7).toFixed(1)} a day)`,
        });
      }
    }
  }

  if (input.ai24h) {
    const perTask = new Map<string, { calls: number; ok: number }>();
    for (const row of input.ai24h.by_task) {
      const tally = perTask.get(row.task) ?? { calls: 0, ok: 0 };
      tally.calls += row.calls;
      tally.ok += row.ok_calls;
      perTask.set(row.task, tally);
    }
    for (const [task, { calls, ok }] of perTask) {
      if (calls >= AI_MIN_CALLS && (ok / calls) * 100 < AI_MIN_SUCCESS_PCT) {
        add({ id: `ai-success-${task}`, severity: 'warning', section: 'ai', message: `AI task "${task}" succeeded ${Math.round((ok / calls) * 100)}% of ${calls} calls in 24 hours` });
      }
    }
    if (input.ai24h.billing_errors > 0) {
      add({
        id: 'ai-billing',
        severity: 'error',
        section: 'ai',
        message: `${input.ai24h.billing_errors} AI call${input.ai24h.billing_errors === 1 ? '' : 's'} refused for billing in 24 hours: top up the Gemini project`,
      });
    }
  }

  if (input.spend && input.spend.capUsd > 0) {
    const fraction = input.spend.todayUsd / input.spend.capUsd;
    if (fraction >= SPEND_WARN_FRACTION) {
      add({
        id: 'ai-spend',
        severity: fraction >= 1 ? 'error' : 'warning',
        section: 'cost',
        message: `Today's AI spend is ${Math.round(fraction * 100)}% of the daily cap ($${input.spend.todayUsd.toFixed(2)} of $${input.spend.capUsd.toFixed(2)})`,
      });
    }
  }

  if (input.coles && input.coles.limit > 0) {
    const fraction = input.coles.used / input.coles.limit;
    if (fraction >= COLES_WARN_FRACTION) {
      add({
        id: 'coles-quota',
        severity: fraction >= 1 ? 'error' : 'warning',
        section: 'cost',
        message: `Coles lookups are at ${Math.round(fraction * 100)}% of the month's limit (${input.coles.used} of ${input.coles.limit})`,
      });
    }
  }

  if (input.schema) {
    const missing = input.schema.filter((check) => !check.applied).map((check) => check.migration);
    if (missing.length > 0) {
      add({ id: 'migrations-missing', severity: 'warning', section: 'database', message: `Migration${missing.length === 1 ? '' : 's'} not run: ${missing.join(', ')}` });
    }
  }

  for (const household of input.households ?? []) {
    if (household.last3_generation_failed) {
      add({
        id: `stuck-${shortId(household.id)}`,
        severity: 'warning',
        section: 'households',
        message: `Household ${shortId(household.id)}: the last 3 recipe generations all failed`,
      });
    }
  }

  if (input.unavailable && input.unavailable.length > 0) {
    add({ id: 'checks-unavailable', severity: 'warning', section: 'status', message: `Some checks couldn't run: ${input.unavailable.join(', ')}` });
  }

  // Errors before warnings, otherwise in the order found.
  return [...items.filter((item) => item.severity === 'error'), ...items.filter((item) => item.severity === 'warning')];
}
