/**
 * Display rules for the plan's day cards (#160). Pure, so the rules are
 * tested here rather than through the components.
 */

/** A meal over this many minutes is flagged as a long cook, on any night. */
export const LONG_COOK_MINS = 60;

export function isLongCook(timeMins: number): boolean {
  return timeMins > LONG_COOK_MINS;
}

/**
 * Each meal's tags without the ones every planned meal shares: a tag on
 * every card doesn't tell meals apart. `null` is an empty night and doesn't
 * count. With fewer than two meals, nothing is shared, so every tag shows.
 */
export function distinctTags(tagsByNight: (string[] | null)[]): (string[] | null)[] {
  const planned = tagsByNight.filter((tags): tags is string[] => tags !== null);
  if (planned.length < 2) return tagsByNight;
  const shared = new Set(planned[0].filter((tag) => planned.every((tags) => tags.includes(tag))));
  return tagsByNight.map((tags) => (tags ? tags.filter((tag) => !shared.has(tag)) : null));
}

/** Monday to Sunday of the week starting `mondayISO` (YYYY-MM-DD), as "27 Oct". */
export function weekDateLabels(mondayISO: string): string[] {
  const [year, month, day] = mondayISO.split('-').map(Number);
  return Array.from({ length: 7 }, (_, offset) =>
    new Date(year, month - 1, day + offset).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  );
}
