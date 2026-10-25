/**
 * "Shopping complete" for a week (#173): one localStorage flag per week,
 * keyed by its Monday. Set from the shopping list, cleared when a plan for
 * the week is confirmed (a new shop), so the list shows again.
 */

import { STORAGE_KEYS } from './storage';

const key = (weekISO: string) => `${STORAGE_KEYS.SHOPPING_COMPLETE_PREFIX}${weekISO}`;

export function isShoppingComplete(weekISO: string): boolean {
  return localStorage.getItem(key(weekISO)) === 'true';
}

export function markShoppingComplete(weekISO: string): void {
  localStorage.setItem(key(weekISO), 'true');
}

export function clearShoppingComplete(weekISO: string): void {
  localStorage.removeItem(key(weekISO));
}
