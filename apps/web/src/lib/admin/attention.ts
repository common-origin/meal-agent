/**
 * "Needs attention" on /admin: everything the dashboard flags is computed
 * here, from data read when the page is loaded (there are no emails or
 * alerts, #244). Pure: each input is optional, and a rule whose input is
 * missing is skipped (the page then says which checks couldn't run).
 *
 * Each item reads like a Supabase Advisor finding (#279): a severity, a short
 * title, where it is, since when, what to do step by step, and where to click
 * to do it.
 */

import { ago, shortId } from './format';
import type { AiSummary, AttentionAction, AttentionItem, ErrorGroup, HealthCheckRow, HouseholdRowRaw, SchemaCheck } from './types';

export const SPIKE_MIN_24H = 5;
export const SPIKE_FACTOR = 3;
export const AI_MIN_CALLS = 10;
export const AI_MIN_SUCCESS_PCT = 90;
export const SPEND_WARN_FRACTION = 0.8;
export const COLES_WARN_FRACTION = 0.8;
const DAY_MS = 86_400_000;

/** First seen in the last 24 hours (first ever, not first in the page's range). */
export const isNewError = (group: Pick<ErrorGroup, 'first_seen'>, now: Date): boolean => now.getTime() - new Date(group.first_seen).getTime() < DAY_MS;

/**
 * An error group's last 24 hours is at least SPIKE_MIN_24H and well over its
 * usual daily rate. A new error has no usual rate (its 7 days are its 24
 * hours), so it is "new" and never also a spike. `count_7d` must be a true
 * 7-day count: the SQL counts within the page's range, so on the 24-hour range
 * it equals `count_24h` and says nothing about the rate (callers skip it there).
 */
export const isSpike = (group: Pick<ErrorGroup, 'count_24h' | 'count_7d' | 'first_seen'>, now: Date): boolean =>
  !isNewError(group, now) && group.count_24h >= SPIKE_MIN_24H && group.count_24h > SPIKE_FACTOR * (group.count_7d / 7);

export interface AttentionInput {
  now: Date;
  /**
   * Latest health row, with the staleness and outage flags computed from uptime.
   * `failingSince` is when the current run of failing checks began, when the
   * recent checks show a passing one before it (see failingSince below).
   */
  health?: { latest: HealthCheckRow | null; heartbeatStale: boolean; outageNow: boolean; failingSince?: string | null } | null;
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

/**
 * When the current run of failing checks began: the first failing row after
 * the newest passing one. Null when the newest row passes, or when every row
 * given is failing (the run started before the first row, so "since" would be
 * a guess). Rows in any order.
 */
export function failingSince(rows: { created_at: string; ok: boolean }[]): string | null {
  const sorted = [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const lastOk = sorted.map((row) => row.ok).lastIndexOf(true);
  if (sorted.length === 0 || sorted[sorted.length - 1].ok || lastOk === -1) return null;
  return sorted[lastOk + 1].created_at;
}

const LOGS: AttentionAction = { label: 'Open Vercel logs', target: 'vercel-logs' };
const UPTIME: AttentionAction = { label: 'Open the Uptime workflow', target: 'uptime-workflow' };
const SQL: AttentionAction = { label: 'Open the Supabase SQL editor', target: 'supabase-sql' };

/** What to check for each dependency the health check covers, by the detail it reports. */
function dependencyStep(name: string, detail: string | undefined): string {
  switch (name) {
    case 'database':
      return 'database: check the Supabase project is running (not paused) and that SUPABASE_SERVICE_ROLE_KEY in Vercel is current.';
    case 'gemini':
      return detail === 'billing_errors_last_hour'
        ? 'gemini: Google refused calls for billing in the last hour. Top up the prepaid credits on the Gemini project in AI Studio.'
        : `gemini: ${detail ?? 'the check failed'}. Check GEMINI_API_KEY in Vercel and Google's status page.`;
    case 'coles':
      return detail === 'quota_used_up' ? 'coles: the monthly lookup quota is used up. Raise COLES_API_MONTHLY_LIMIT or wait for next month.' : `coles: ${detail ?? 'the check failed'}. Check RAPIDAPI_KEY in Vercel and the RapidAPI plan.`;
    case 'email':
      return 'email: set RESEND_API_KEY and RESEND_FROM_ADDRESS in Vercel.';
    case 'config':
      return `config: ${detail ?? 'a required setting is missing'}. Add the missing variable in Vercel and redeploy.`;
    default:
      return `${name}: ${detail ?? 'the check failed'}.`;
  }
}

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
        title: latest ? 'Health checks have stopped' : 'No health check recorded yet',
        where: 'Status · health check heartbeat',
        since: latest?.created_at ?? null,
        window: 'now',
        message: latest ? 'No health check in the last 30 minutes (is the Uptime workflow running?)' : 'No health check has been recorded yet',
        fix: [
          'Open the Uptime workflow on GitHub and check its latest runs. GitHub disables scheduled workflows after 60 days without repository activity.',
          'Run it once with "Run workflow". A row should appear here within a minute.',
          'If the run fails, check that the HEALTH_CHECK_URL variable and the HEALTH_CHECK_SECRET secret match the app in Vercel.',
        ],
        actions: [UPTIME, LOGS],
      });
    }
    if (latest && !latest.ok) {
      const failing = Object.entries(latest.checks ?? {}).filter(([, check]) => !check.ok);
      const names = failing.map(([name]) => name);
      add({
        id: 'health-failing',
        severity: 'error',
        section: 'status',
        title: 'Health check failing',
        where: `Status · ${names.length ? names.join(', ') : 'a dependency'}`,
        since: input.health.failingSince ?? null,
        window: 'latest check',
        message: `The latest health check is failing${names.length ? `: ${names.join(', ')}` : ''}`,
        fix: [
          ...failing.map(([name, check]) => dependencyStep(name, check.detail)),
          'Look at the Status section for the detail each check reported, then run the Uptime workflow again to confirm it recovers.',
        ],
        actions: [{ label: 'See the check detail', target: 'section' }, LOGS, UPTIME],
      });
    }
    if (outageNow) {
      add({
        id: 'outage-now',
        severity: 'error',
        section: 'status',
        title: 'Possible outage',
        where: 'Status · uptime',
        since: null,
        window: 'now',
        message: 'Possible outage: two or more consecutive health-check slots with no heartbeat',
        fix: [
          'Open the app in a private window. If it loads, the monitor stopped rather than the app: run the Uptime workflow.',
          'If it does not load, open the Vercel runtime logs and the latest deployment for errors.',
        ],
        actions: [LOGS, UPTIME, { label: 'See uptime', target: 'section' }],
      });
    }
  }

  if (input.errors7d) {
    const fresh = input.errors7d.filter((group) => isNewError(group, now));
    if (fresh.length > 0) {
      const names = fresh.slice(0, 3).map(describeGroup).join('; ');
      const earliest = fresh.reduce((first, group) => (new Date(group.first_seen) < new Date(first) ? group.first_seen : first), fresh[0].first_seen);
      add({
        id: 'new-errors',
        severity: 'warning',
        section: 'errors',
        title: fresh.length === 1 ? 'New error' : `${fresh.length} new errors`,
        where: fresh.length === 1 ? `Errors · ${fresh[0].route ?? fresh[0].source}` : 'Errors · several routes',
        since: earliest,
        window: 'last 24 hours',
        message: `${fresh.length} new error${fresh.length === 1 ? '' : 's'} in the last 24 hours: ${names}${fresh.length > 3 ? '…' : ''}`,
        fix: [
          'Open the error in the Errors section tagged New and read the message, route and release.',
          'If it started with the latest release, look at what changed in that deploy; "Search the code" on the error finds where it is raised.',
          'Open the Vercel runtime logs for the route to see the surrounding requests.',
        ],
        actions: [{ label: 'See the new errors', target: 'section' }, LOGS],
      });
    }
    for (const group of input.errors7d) {
      if (isSpike(group, now)) {
        add({
          id: `spike-${group.fingerprint}`,
          severity: 'warning',
          section: 'errors',
          title: 'Error spike',
          where: `Errors · ${group.route ?? group.source}`,
          since: null,
          window: 'last 24 hours',
          message: `Error spike: ${describeGroup(group)} happened ${group.count_24h} times in 24 hours (7-day average ${(group.count_7d / 7).toFixed(1)} a day)`,
          fix: [
            `Open the error and check which release and how many households it affects (${group.households} so far).`,
            'Compare the time it started with the deploy time in Vercel; roll back the deploy if it lines up.',
            'Open the Vercel runtime logs for the route to see what the failing requests have in common.',
          ],
          actions: [{ label: 'See the errors', target: 'section' }, LOGS],
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
        add({
          id: `ai-success-${task}`,
          severity: 'warning',
          section: 'ai',
          title: 'AI task failing often',
          where: `AI agent · ${task}`,
          since: null,
          window: 'last 24 hours',
          message: `AI task "${task}" succeeded ${Math.round((ok / calls) * 100)}% of ${calls} calls in 24 hours`,
          fix: [
            'Open the AI agent section and look at the status and error codes for this task, and at the latest failed calls.',
            'http_503 or a timeout is usually Google being slow: wait and watch. http_429 means rate limits; http_400 or a parse error points at a prompt or schema change in the latest release.',
          ],
          actions: [{ label: 'See the AI agent', target: 'section' }, LOGS],
        });
      }
    }
    if (input.ai24h.billing_errors > 0) {
      add({
        id: 'ai-billing',
        severity: 'error',
        section: 'ai',
        title: 'AI calls refused for billing',
        where: 'AI agent · Gemini billing',
        since: null,
        window: 'last 24 hours',
        message: `${input.ai24h.billing_errors} AI call${input.ai24h.billing_errors === 1 ? '' : 's'} refused for billing in 24 hours: top up the Gemini project`,
        fix: [
          'Open AI Studio, find the project that owns GEMINI_API_KEY and top up its prepaid credits (Google returns 402 "prepayment credits are depleted").',
          'Run the Uptime workflow once to confirm the gemini check passes again. Households see "AI features aren\'t available" until you do.',
        ],
        actions: [UPTIME, { label: 'See the AI agent', target: 'section' }],
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
        title: fraction >= 1 ? 'AI daily cap reached' : 'AI spend near the daily cap',
        where: 'Cost and quotas · AI spend today',
        since: null,
        window: 'today (UTC)',
        message: `Today's AI spend is ${Math.round(fraction * 100)}% of the daily cap ($${input.spend.todayUsd.toFixed(2)} of $${input.spend.capUsd.toFixed(2)})`,
        fix: [
          fraction >= 1 ? 'AI features are paused for every household until midnight UTC.' : 'At the cap, AI features pause for every household until midnight UTC.',
          'Check the AI agent section for a task that is calling far more than usual (a retry loop shows as many failed calls).',
          'To allow more today, raise AI_DAILY_SPEND_CAP_USD in Vercel and redeploy.',
        ],
        actions: [{ label: 'See cost and quotas', target: 'section' }, { label: 'Open Vercel project', target: 'vercel-project' }],
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
        title: fraction >= 1 ? 'Coles lookups used up' : 'Coles lookups running low',
        where: 'Cost and quotas · Coles lookups',
        since: null,
        window: 'this month',
        message: `Coles lookups are at ${Math.round(fraction * 100)}% of the month's limit (${input.coles.used} of ${input.coles.limit})`,
        fix: [
          'Price lookups stop for every household when the limit is reached, and resume next month.',
          'If your RapidAPI plan allows more, raise COLES_API_MONTHLY_LIMIT in Vercel to match it and redeploy.',
        ],
        actions: [{ label: 'See cost and quotas', target: 'section' }, { label: 'Open Vercel project', target: 'vercel-project' }],
      });
    }
  }

  if (input.schema) {
    const missing = input.schema.filter((check) => !check.applied);
    if (missing.length > 0) {
      const numbers = missing.map((check) => check.migration);
      add({
        id: 'migrations-missing',
        severity: 'warning',
        section: 'database',
        title: `Migration${missing.length === 1 ? '' : 's'} not run`,
        where: `Database · ${numbers.join(', ')}`,
        since: null,
        window: 'now',
        message: `Migration${missing.length === 1 ? '' : 's'} not run: ${numbers.join(', ')}`,
        fix: [
          `Open each file in supabase/migrations (${missing.map((check) => `${check.migration}_${check.name}.sql`).join(', ')}) and copy its contents.`,
          'Paste it into the Supabase SQL editor and run it, oldest first. Reload this page to confirm it is gone.',
        ],
        actions: [SQL, { label: 'See the database', target: 'section' }],
      });
    }
  }

  for (const household of input.households ?? []) {
    if (household.last3_generation_failed) {
      add({
        id: `stuck-${shortId(household.id)}`,
        severity: 'warning',
        section: 'households',
        title: 'Recipe generation stuck',
        where: `Households · ${shortId(household.id)}`,
        since: null,
        window: 'last 3 generations',
        message: `Household ${shortId(household.id)}: the last 3 recipe generations all failed`,
        fix: [
          'Open the AI agent section filtered to this household (select its ID in Households) and read the error codes of its failed calls.',
          'If the failures are the AI provider, they clear on their own. If the same code repeats, check the household settings for something the prompt cannot handle.',
        ],
        actions: [{ label: 'See households', target: 'section' }, LOGS],
      });
    }
  }

  if (input.unavailable && input.unavailable.length > 0) {
    add({
      id: 'checks-unavailable',
      severity: 'warning',
      section: 'status',
      title: "Some checks couldn't run",
      where: `Status · ${input.unavailable.join(', ')}`,
      since: null,
      window: 'now',
      message: `Some checks couldn't run: ${input.unavailable.join(', ')}`,
      fix: [
        'The page could not read the data these rules need, so they were skipped rather than passed. A missing reporting function usually means migration 022 has not run.',
        'Check the sections below for "Couldn\'t load" and the migration each one names.',
      ],
      actions: [SQL, LOGS],
    });
  }

  // Errors before warnings, otherwise in the order found.
  return [...items.filter((item) => item.severity === 'error'), ...items.filter((item) => item.severity === 'warning')];
}

/** "since 3 h ago" when the rule knows when it started, else the period it looked at. */
export function attentionWhen(item: Pick<AttentionItem, 'since' | 'window'>, now: Date): string {
  return item.since ? `since ${ago(item.since, now)}` : item.window;
}
