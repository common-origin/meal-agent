/**
 * The household's timezone (#220): which IANA zone its dinners and seasons
 * are in. Australia-only for now, so Settings offers the seven Australian
 * zones; anything valid that was saved is still honoured.
 */

/** Used when a household hasn't set one: the most populous zone, and the calendar feed's zone before #220. */
export const DEFAULT_HOUSEHOLD_TIME_ZONE = 'Australia/Sydney';

export const AUSTRALIAN_TIME_ZONES = [
  { id: 'Australia/Sydney', label: 'New South Wales and ACT (Sydney)' },
  { id: 'Australia/Melbourne', label: 'Victoria (Melbourne)' },
  { id: 'Australia/Brisbane', label: 'Queensland (Brisbane)' },
  { id: 'Australia/Adelaide', label: 'South Australia (Adelaide)' },
  { id: 'Australia/Darwin', label: 'Northern Territory (Darwin)' },
  { id: 'Australia/Perth', label: 'Western Australia (Perth)' },
  { id: 'Australia/Hobart', label: 'Tasmania (Hobart)' },
] as const;

/** True when the runtime knows `timeZone` as an IANA zone. */
export function isValidTimeZone(timeZone: string | undefined | null): timeZone is string {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat('en-AU', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The first of `candidates` that's a valid zone, else the default. */
export function pickTimeZone(...candidates: (string | undefined | null)[]): string {
  return candidates.find(isValidTimeZone) ?? DEFAULT_HOUSEHOLD_TIME_ZONE;
}

/**
 * The zone to pre-fill for a household that hasn't chosen one: the
 * browser's, when it's one of the Australian zones Settings lists, else the
 * default.
 */
export function suggestedTimeZone(browserZone: string | undefined): string {
  return AUSTRALIAN_TIME_ZONES.some((zone) => zone.id === browserZone) ? browserZone! : DEFAULT_HOUSEHOLD_TIME_ZONE;
}

/** Settings' options: the Australian zones, plus a saved zone that isn't one of them. */
export function timeZoneOptions(current: string | undefined): { id: string; label: string }[] {
  const options: { id: string; label: string }[] = AUSTRALIAN_TIME_ZONES.map(({ id, label }) => ({ id, label }));
  if (current && !options.some((option) => option.id === current)) options.push({ id: current, label: current });
  return options;
}
