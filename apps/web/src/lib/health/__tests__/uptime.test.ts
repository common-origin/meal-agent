import { describe, it, expect } from 'vitest';
import { SLOT_MS, buildSlots, summariseUptime, lastIncident, isHeartbeatStale, runsOf } from '../uptime';

// A clock-aligned origin: 2026-11-18 00:00 UTC.
const T0 = Date.UTC(2026, 10, 18, 0, 0, 0);
const at = (slot: number, offsetMs = 60_000) => new Date(T0 + slot * SLOT_MS + offsetMs).toISOString();
const row = (slot: number, ok = true) => ({ created_at: at(slot), ok });
const states = (rows: ReturnType<typeof row>[], slots: number) => buildSlots(rows, T0, T0 + slots * SLOT_MS).map((s) => s.state);

describe('buildSlots', () => {
  it('cuts the range into 15 minute slots and classifies each', () => {
    expect(states([row(0), row(1, false), row(3)], 4)).toEqual(['ok', 'failing', 'no_data', 'ok']);
  });

  it('a slot with any failing check is failing, even if another check in it passed', () => {
    expect(states([row(0), row(0, false)], 1)).toEqual(['failing']);
  });

  it('only counts slots that have fully ended', () => {
    // The range ends 5 minutes into slot 2, so slot 2 is still in progress.
    const slots = buildSlots([row(0)], T0, T0 + 2 * SLOT_MS + 5 * 60_000);
    expect(slots.map((s) => s.start)).toEqual([T0, T0 + SLOT_MS]);
  });

  it('aligns slots to the clock, not to the range start', () => {
    const slots = buildSlots([], T0 + 5 * 60_000, T0 + 3 * SLOT_MS);
    expect(slots.map((s) => s.start)).toEqual([T0 + SLOT_MS, T0 + 2 * SLOT_MS]);
  });

  it('ignores rows outside the range and unparseable dates; accepts numbers and Dates', () => {
    const rows = [
      { created_at: T0 - 1000, ok: true },
      { created_at: 'not a date', ok: true },
      { created_at: new Date(T0 + 20 * 60_000), ok: true },
      { created_at: T0 + 100 * SLOT_MS, ok: true },
    ];
    expect(buildSlots(rows, T0, T0 + 3 * SLOT_MS).map((s) => s.state)).toEqual(['no_data', 'ok', 'no_data']);
  });

  it('is empty for an empty or inverted range', () => {
    expect(buildSlots([], T0, T0)).toEqual([]);
    expect(buildSlots([], T0 + SLOT_MS, T0)).toEqual([]);
  });
});

describe('summariseUptime: gaps are "no data", not "down"', () => {
  it('uptime % is ok / (ok + failing) with the no-data share beside it', () => {
    // ok, ok, failing, ok, then 4 empty slots: 3 of 4 measured slots are ok.
    const s = summariseUptime([row(0), row(1), row(2, false), row(3)], T0, T0 + 8 * SLOT_MS);
    expect(s).toMatchObject({ okSlots: 3, failingSlots: 1, noDataSlots: 4 });
    expect(s.uptimePct).toBeCloseTo(75);
    expect(s.noDataShare).toBeCloseTo(0.5);
  });

  it('a single missing slot is a dropped run, not an outage', () => {
    const s = summariseUptime([row(0), row(2), row(3)], T0, T0 + 4 * SLOT_MS);
    expect(s.noDataSlots).toBe(1);
    expect(s.possibleOutages).toEqual([]);
    expect(s.outageNow).toBe(false);
    expect(s.uptimePct).toBe(100);
  });

  it('two or more consecutive empty slots are a possible outage (no heartbeat)', () => {
    const s = summariseUptime([row(0), row(1), row(4), row(5)], T0, T0 + 6 * SLOT_MS);
    expect(s.possibleOutages).toEqual([{ start: T0 + 2 * SLOT_MS, end: T0 + 4 * SLOT_MS, slots: 2 }]);
    expect(s.outageNow).toBe(false);
  });

  it('flags an outage that is still going on when the empty run reaches the latest slot', () => {
    const s = summariseUptime([row(0), row(1)], T0, T0 + 5 * SLOT_MS);
    expect(s.possibleOutages).toEqual([{ start: T0 + 2 * SLOT_MS, end: T0 + 5 * SLOT_MS, slots: 3 }]);
    expect(s.outageNow).toBe(true);
  });

  it('reports separate runs separately', () => {
    const s = summariseUptime([row(0), row(3), row(6)], T0, T0 + 7 * SLOT_MS);
    expect(s.possibleOutages.map((r) => r.slots)).toEqual([2, 2]);
  });

  it('has no percentage when nothing was measured', () => {
    const s = summariseUptime([], T0, T0 + 4 * SLOT_MS);
    expect(s.uptimePct).toBeNull();
    expect(s.noDataShare).toBe(1);
    expect(summariseUptime([], T0, T0).noDataShare).toBe(0);
  });
});

describe('lastIncident', () => {
  it('is the most recent run of failing slots', () => {
    const slots = buildSlots([row(0), row(1, false), row(2, false), row(3), row(4, false), row(5)], T0, T0 + 6 * SLOT_MS);
    expect(lastIncident(slots)).toEqual({ start: T0 + 4 * SLOT_MS, end: T0 + 5 * SLOT_MS, slots: 1 });
  });

  it('joins failing slots with an adjacent possible outage, and ignores a lone gap', () => {
    const joined = buildSlots([row(0), row(1, false), row(4)], T0, T0 + 5 * SLOT_MS);
    expect(lastIncident(joined)).toEqual({ start: T0 + SLOT_MS, end: T0 + 4 * SLOT_MS, slots: 3 });
    const lone = buildSlots([row(0), row(2)], T0, T0 + 3 * SLOT_MS);
    expect(lastIncident(lone)).toBeNull();
  });

  it('is null when all is well', () => {
    expect(lastIncident(buildSlots([row(0), row(1)], T0, T0 + 2 * SLOT_MS))).toBeNull();
  });
});

describe('runsOf and isHeartbeatStale', () => {
  it('runsOf respects the minimum length', () => {
    const slots = buildSlots([row(0), row(2)], T0, T0 + 4 * SLOT_MS);
    expect(runsOf(slots, ['no_data']).map((r) => r.slots)).toEqual([1, 1]);
    expect(runsOf(slots, ['no_data'], 2)).toEqual([]);
  });

  it('the heartbeat is stale after 30 minutes, or with no row at all', () => {
    const now = T0 + 60 * 60_000;
    expect(isHeartbeatStale(new Date(now - 29 * 60_000).toISOString(), now)).toBe(false);
    expect(isHeartbeatStale(new Date(now - 31 * 60_000).toISOString(), now)).toBe(true);
    expect(isHeartbeatStale(null, now)).toBe(true);
    expect(isHeartbeatStale('garbage', now)).toBe(true);
  });
});
