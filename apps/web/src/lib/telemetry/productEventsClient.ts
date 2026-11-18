/**
 * Browser side of anonymous product events (admin dashboard, #247). Client
 * only.
 *
 * `toServerEvent()` maps a local analytics event to its whitelisted server
 * form, picking only the allowed props by name (never spreading `meta`, which
 * holds recipe IDs and titles for the local analytics page) and validating the
 * result against the strict schema. Events are queued and flushed in batches:
 * after a short debounce, and on pagehide / when the tab is hidden, via
 * navigator.sendBeacon (falling back to fetch with keepalive).
 */

import type { AnalyticsEventType } from '@/lib/analytics';
import { EVENTS_ENDPOINT, MAX_EVENTS_PER_BATCH, serverEventSchema, type ServerEvent } from './productEvents';

type Meta = Record<string, unknown> | undefined;

const pick = (meta: Meta, keys: string[]): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const key of keys) if (meta && key in meta) out[key] = meta[key];
  return out;
};

/** The server form of a local event, or null when it isn't sent (not whitelisted, not manual effort, or invalid). */
export function toServerEvent(type: AnalyticsEventType, meta?: Record<string, unknown>): ServerEvent | null {
  let candidate: { type: string; props: Record<string, unknown> } | null;
  switch (type) {
    case 'plan_composed':
      candidate = { type, props: pick(meta, ['dayCount', 'pantryItemCount', 'cuisineCount', 'proteinVariety', 'weekStart']) };
      break;
    case 'plan_confirmed':
    case 'shopping_completed':
      candidate = { type, props: pick(meta, ['weekStart']) };
      break;
    case 'plan_edit':
    case 'plan_edit_accepted':
      candidate = { type, props: pick(meta, ['nights']) };
      break;
    case 'swap': {
      // Not manual effort: nights filled in after generation (oldRecipeId 'empty').
      if (meta?.oldRecipeId === 'empty') return null;
      const kind = meta?.newRecipeId === 'deleted' ? 'delete' : meta?.action === 'add' ? 'add' : 'swap';
      candidate = { type, props: { kind } };
      break;
    }
    case 'shopping_list_built':
    case 'coles_list_sent':
      candidate = { type, props: pick(meta, ['weekStart', 'itemCount']) };
      break;
    case 'recipe_rated':
      candidate = { type, props: pick(meta, ['stars']) };
      break;
    case 'export_csv':
    case 'favorite_added':
    case 'favorite_removed':
    case 'price_reported':
    case 'recipe_emailed':
      candidate = { type, props: {} };
      break;
    default:
      return null;
  }
  const parsed = serverEventSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

const DEBOUNCE_MS = 5000;

/** localStorage key for the analytics opt-out (lib/analytics.ts). Checked again at send time, so an opt-out in another tab also stops what is queued here. */
export const OPT_OUT_KEY = 'ma_analytics_optout';

function optedOut(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === 'true';
  } catch {
    return false;
  }
}

let queue: ServerEvent[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let listening = false;

function send(batch: ServerEvent[]): void {
  const body = JSON.stringify({ events: batch });
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      if (navigator.sendBeacon(EVENTS_ENDPOINT, new Blob([body], { type: 'application/json' }))) return;
    }
    void fetch(EVENTS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Telemetry never breaks the page.
  }
}

/** Sends everything queued, in batches the server accepts. */
export function flushServerEvents(): void {
  if (timer) clearTimeout(timer);
  timer = undefined;
  const pending = optedOut() ? [] : queue;
  queue = [];
  for (let i = 0; i < pending.length; i += MAX_EVENTS_PER_BATCH) send(pending.slice(i, i + MAX_EVENTS_PER_BATCH));
}

/** Drops anything not yet sent (when the user opts out). */
export function clearServerEventQueue(): void {
  if (timer) clearTimeout(timer);
  timer = undefined;
  queue = [];
}

export function enqueueServerEvent(event: ServerEvent): void {
  if (typeof window === 'undefined') return;
  if (!listening) {
    listening = true;
    window.addEventListener('pagehide', flushServerEvents);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushServerEvents();
    });
  }
  queue.push(event);
  if (queue.length >= MAX_EVENTS_PER_BATCH) return flushServerEvents();
  if (!timer) timer = setTimeout(flushServerEvents, DEBOUNCE_MS);
}
