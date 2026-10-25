import { describe, it, expect, beforeEach } from 'vitest';
import { STORAGE_KEYS } from '../storage';
import { clearShoppingComplete, isShoppingComplete, markShoppingComplete } from '../shoppingCompletion';

describe('shopping completion flag (#173)', () => {
  beforeEach(() => localStorage.clear());

  it('marks, reads and clears one week without touching another', () => {
    expect(isShoppingComplete('2026-10-26')).toBe(false);
    markShoppingComplete('2026-10-26');
    markShoppingComplete('2026-11-02');
    expect(isShoppingComplete('2026-10-26')).toBe(true);
    // The key the household-cache sweep (clearHouseholdScopedCaches) removes by prefix
    expect(localStorage.getItem(`${STORAGE_KEYS.SHOPPING_COMPLETE_PREFIX}2026-10-26`)).toBe('true');

    clearShoppingComplete('2026-10-26');
    expect(isShoppingComplete('2026-10-26')).toBe(false);
    expect(isShoppingComplete('2026-11-02')).toBe(true);
  });
});
