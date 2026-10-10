/**
 * This week's pantry list and its "use soon" flags (#91)
 *
 * The saved pantry list stays a plain string[]; which items need using soon
 * is per-week state kept alongside it. Flags are matched by name (case-
 * insensitive), not position, so they survive adding and removing other
 * items. Shared by the plan wizard and the plan page's pantry sheet.
 */

export interface PantryState {
  items: string[];
  /** Names from `items` flagged to use first. */
  useSoon: string[];
}

export interface ScannedPantryItem {
  name: string;
  useSoon: boolean;
}

const key = (name: string) => name.trim().toLowerCase();

function hasName(names: string[], name: string): boolean {
  return names.some((n) => key(n) === key(name));
}

/** Add scanned items not already listed; flag any the scan marked use-soon, new or existing. */
export function mergeScan(state: PantryState, scanned: ScannedPantryItem[]): PantryState {
  const items = [...state.items];
  const useSoon = [...state.useSoon];
  for (const { name, useSoon: soon } of scanned) {
    if (!name.trim()) continue;
    const existing = items.find((item) => key(item) === key(name));
    if (!existing) items.push(name);
    if (soon && !hasName(useSoon, name)) useSoon.push(existing ?? name);
  }
  return { items, useSoon };
}

export function addItem(state: PantryState, name: string): PantryState {
  const trimmed = name.trim();
  if (!trimmed || hasName(state.items, trimmed)) return state;
  return { ...state, items: [...state.items, trimmed] };
}

export function removeItem(state: PantryState, index: number): PantryState {
  const removed = state.items[index];
  if (removed === undefined) return state;
  return {
    items: state.items.filter((_, i) => i !== index),
    useSoon: state.useSoon.filter((name) => key(name) !== key(removed)),
  };
}

export function isUseSoon(state: PantryState, name: string): boolean {
  return hasName(state.useSoon, name);
}

export function toggleUseSoon(state: PantryState, name: string): PantryState {
  return {
    ...state,
    useSoon: isUseSoon(state, name)
      ? state.useSoon.filter((n) => key(n) !== key(name))
      : [...state.useSoon, name],
  };
}

/** The flagged items still in the list, in list order: what generation receives. */
export function itemsToUseSoon(state: PantryState): string[] {
  return state.items.filter((item) => isUseSoon(state, item));
}
