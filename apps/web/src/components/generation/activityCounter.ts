/**
 * A ref/counter-backed "is anything active" tracker that handles
 * overlapping begin/end calls (e.g. a swap regeneration starting while a
 * full week is still generating) without the first call's completion
 * re-enabling sign-out while a second is still running, and without going
 * negative if end() is ever called more than begin().
 *
 * Kept separate from GenerationActivityProvider's React glue so the
 * counting logic can be unit-tested on its own. (It was split out while
 * mismatched react/react-dom versions broke rendering in tests, #74; the
 * provider itself now has rendered tests too.)
 */
export function createActivityCounter(onChange: (active: boolean) => void) {
  let count = 0;

  return {
    begin(): void {
      count += 1;
      onChange(true);
    },
    end(): void {
      count = Math.max(0, count - 1);
      if (count === 0) {
        onChange(false);
      }
    },
  };
}
