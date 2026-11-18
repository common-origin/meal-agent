/**
 * Uptime from stored health checks, computed when the dashboard is read
 * (#248). Pure: no I/O.
 *
 * The range is cut into 15-minute slots aligned to the clock. A slot is
 * `failing` if any check in it failed, `ok` if it had checks and none failed,
 * and `no_data` if it had none. Missing slots are "no data", not "down":
 * GitHub sometimes drops or delays scheduled runs. But a fully-down app can't
 * record a row either, so two or more consecutive empty slots are flagged as a
 * possible outage. Only fully elapsed slots count.
 */

export const SLOT_MS = 15 * 60 * 1000;
/** The scheduled workflow runs every 15 minutes; no row for this long means the heartbeat is lost. */
export const STALE_AFTER_MS = 30 * 60 * 1000;
/** Consecutive empty slots that read as an outage rather than a dropped run. */
export const OUTAGE_EMPTY_SLOTS = 2;

export type SlotState = 'ok' | 'failing' | 'no_data';

export interface HealthRow {
  created_at: string | number | Date;
  ok: boolean;
}

export interface Slot {
  /** Slot start, epoch ms. */
  start: number;
  state: SlotState;
}

export interface Run {
  /** First slot start, epoch ms. */
  start: number;
  /** End of the last slot, epoch ms. */
  end: number;
  slots: number;
}

export interface UptimeSummary {
  slots: Slot[];
  okSlots: number;
  failingSlots: number;
  noDataSlots: number;
  /** ok / (ok + failing), as a percentage, or null when there is nothing to measure. */
  uptimePct: number | null;
  /** The share of slots with no data, 0 to 1 (0 when there are no slots). */
  noDataShare: number;
  /** Runs of OUTAGE_EMPTY_SLOTS or more empty slots: "possible outage (no heartbeat)". */
  possibleOutages: Run[];
  /** True when the most recent elapsed slots are such a run, i.e. it may be going on now. */
  outageNow: boolean;
}

const toMs = (value: HealthRow['created_at']) => (value instanceof Date ? value.getTime() : new Date(value).getTime());

/** Slots from `from` to `to`, each classified by `rows`. Only slots that have fully ended by `to` are included. */
export function buildSlots(rows: HealthRow[], from: Date | number, to: Date | number): Slot[] {
  const fromMs = from instanceof Date ? from.getTime() : from;
  const toMsValue = to instanceof Date ? to.getTime() : to;
  const first = Math.ceil(fromMs / SLOT_MS) * SLOT_MS;
  const lastEnd = Math.floor(toMsValue / SLOT_MS) * SLOT_MS;
  if (lastEnd <= first) return [];

  const byIndex = new Map<number, { ok: number; failing: number }>();
  for (const row of rows) {
    const t = toMs(row.created_at);
    if (Number.isNaN(t) || t < first || t >= lastEnd) continue;
    const index = Math.floor(t / SLOT_MS);
    const tally = byIndex.get(index) ?? { ok: 0, failing: 0 };
    if (row.ok) tally.ok += 1;
    else tally.failing += 1;
    byIndex.set(index, tally);
  }

  const slots: Slot[] = [];
  for (let start = first; start < lastEnd; start += SLOT_MS) {
    const tally = byIndex.get(start / SLOT_MS);
    slots.push({ start, state: !tally ? 'no_data' : tally.failing > 0 ? 'failing' : 'ok' });
  }
  return slots;
}

/** Runs of consecutive slots in `states`, at least `minSlots` long. */
export function runsOf(slots: Slot[], states: SlotState[], minSlots = 1): Run[] {
  const runs: Run[] = [];
  let startIndex = -1;
  const close = (endIndex: number) => {
    if (startIndex >= 0 && endIndex - startIndex >= minSlots) {
      runs.push({ start: slots[startIndex].start, end: slots[endIndex - 1].start + SLOT_MS, slots: endIndex - startIndex });
    }
    startIndex = -1;
  };
  slots.forEach((slot, i) => {
    if (states.includes(slot.state)) {
      if (startIndex < 0) startIndex = i;
    } else close(i);
  });
  close(slots.length);
  return runs;
}

export function summariseUptime(rows: HealthRow[], from: Date | number, to: Date | number): UptimeSummary {
  const slots = buildSlots(rows, from, to);
  const count = (state: SlotState) => slots.filter((slot) => slot.state === state).length;
  const okSlots = count('ok');
  const failingSlots = count('failing');
  const noDataSlots = count('no_data');
  const measured = okSlots + failingSlots;
  const possibleOutages = runsOf(slots, ['no_data'], OUTAGE_EMPTY_SLOTS);
  const lastEnd = slots.length ? slots[slots.length - 1].start + SLOT_MS : null;
  return {
    slots,
    okSlots,
    failingSlots,
    noDataSlots,
    uptimePct: measured === 0 ? null : (okSlots / measured) * 100,
    noDataShare: slots.length === 0 ? 0 : noDataSlots / slots.length,
    possibleOutages,
    outageNow: lastEnd !== null && possibleOutages.some((run) => run.end === lastEnd),
  };
}

/** The most recent incident: failing slots, or a possible outage, joined where they touch. Null if none. */
export function lastIncident(slots: Slot[]): Run | null {
  // An empty slot counts only as part of a run of OUTAGE_EMPTY_SLOTS or more.
  const outages = runsOf(slots, ['no_data'], OUTAGE_EMPTY_SLOTS);
  const outageStarts = new Set<number>();
  for (const run of outages) for (let start = run.start; start < run.end; start += SLOT_MS) outageStarts.add(start);
  const incidentSlots = slots.map((slot): Slot => ({
    start: slot.start,
    state: slot.state === 'failing' || outageStarts.has(slot.start) ? 'failing' : 'ok',
  }));
  const runs = runsOf(incidentSlots, ['failing']);
  return runs[runs.length - 1] ?? null;
}

/** True when the newest health check is older than STALE_AFTER_MS, or there is none. */
export function isHeartbeatStale(latestCreatedAt: HealthRow['created_at'] | null | undefined, now: Date | number): boolean {
  if (latestCreatedAt === null || latestCreatedAt === undefined) return true;
  const nowMs = now instanceof Date ? now.getTime() : now;
  const t = toMs(latestCreatedAt);
  return Number.isNaN(t) || nowMs - t > STALE_AFTER_MS;
}
