import { describe, it, expect } from 'vitest';
import { DEFAULT_HOUSEHOLD_TIME_ZONE, isValidTimeZone, pickTimeZone, suggestedTimeZone, timeZoneOptions, todayInTimeZone, householdTimeZone, AUSTRALIAN_TIME_ZONES } from '../timeZones';
import { defaultPlanningWeekISO } from '../schedule';
import { DEFAULT_FAMILY_SETTINGS, validateFamilySettings } from '../types/settings';

const withCity = { ...DEFAULT_FAMILY_SETTINGS, location: { ...DEFAULT_FAMILY_SETTINGS.location, city: 'Perth' } };

describe('household timezone (#220)', () => {
  it('knows valid zones from typos', () => {
    expect(AUSTRALIAN_TIME_ZONES.every((zone) => isValidTimeZone(zone.id))).toBe(true);
    expect(isValidTimeZone('Not/AZone')).toBe(false);
    expect(isValidTimeZone(undefined)).toBe(false);
  });

  it('picks the first valid candidate, else Sydney', () => {
    expect(pickTimeZone(undefined, 'Australia/Perth')).toBe('Australia/Perth');
    expect(pickTimeZone('Australia/Darwin', 'Australia/Perth')).toBe('Australia/Darwin');
    expect(pickTimeZone('Not/AZone', undefined)).toBe(DEFAULT_HOUSEHOLD_TIME_ZONE);
  });

  it("suggests the browser's zone only when Settings lists it", () => {
    expect(suggestedTimeZone('Australia/Adelaide')).toBe('Australia/Adelaide');
    expect(suggestedTimeZone('Europe/London')).toBe(DEFAULT_HOUSEHOLD_TIME_ZONE);
    expect(suggestedTimeZone(undefined)).toBe(DEFAULT_HOUSEHOLD_TIME_ZONE);
  });

  it('keeps a saved zone outside the list as an option', () => {
    expect(timeZoneOptions('Australia/Perth')).toHaveLength(AUSTRALIAN_TIME_ZONES.length);
    expect(timeZoneOptions('Pacific/Auckland').at(-1)).toEqual({ id: 'Pacific/Auckland', label: 'Pacific/Auckland' });
  });

  it('validation accepts a valid zone or none, and refuses an unknown one', () => {
    expect(validateFamilySettings(withCity)).toEqual([]);
    expect(validateFamilySettings({ ...withCity, location: { ...withCity.location, timeZone: 'Australia/Perth' } })).toEqual([]);
    expect(validateFamilySettings({ ...withCity, location: { ...withCity.location, timeZone: 'Not/AZone' } })).toEqual(['Choose a valid timezone']);
  });
});

describe('todayInTimeZone (#232)', () => {
  // Thursday 19 November 2026, 15:00 UTC: already Friday in Sydney, still Thursday in Perth.
  const now = new Date('2026-11-19T15:00:00Z');

  it("gives the household's date, not the server's or browser's", () => {
    expect(todayInTimeZone('Australia/Sydney', now)).toBe('2026-11-20');
    expect(todayInTimeZone('Australia/Perth', now)).toBe('2026-11-19');
    expect(todayInTimeZone('UTC', now)).toBe('2026-11-19');
  });

  it("picks the week ahead once it's Friday in the household's zone", () => {
    expect(defaultPlanningWeekISO(todayInTimeZone('Australia/Sydney', now))).toBe('2026-11-23');
    expect(defaultPlanningWeekISO(todayInTimeZone('Australia/Perth', now))).toBe('2026-11-16');
  });
});

describe('householdTimeZone (#232)', () => {
  it("uses the household's saved zone, else the browser's", () => {
    expect(householdTimeZone('Australia/Perth')).toBe('Australia/Perth');
    expect(householdTimeZone(undefined)).toBe(pickTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone));
    expect(householdTimeZone('Not/AZone')).toBe(pickTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone));
  });
});
