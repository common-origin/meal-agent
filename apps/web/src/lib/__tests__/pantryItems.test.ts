import { describe, it, expect } from 'vitest';
import { addItem, isUseSoon, itemsToUseSoon, mergeScan, removeItem, toggleUseSoon, type PantryState } from '../pantryItems';

const empty: PantryState = { items: [], useSoon: [] };

describe('pantryItems', () => {
  it('merges a scan: adds new items once and flags use-soon ones', () => {
    const state = mergeScan({ items: ['Milk'], useSoon: [] }, [
      { name: 'milk', useSoon: true },
      { name: 'capsicum', useSoon: false },
      { name: 'beef mince', useSoon: true },
      { name: '  ', useSoon: true },
    ]);
    expect(state.items).toEqual(['Milk', 'capsicum', 'beef mince']);
    expect(itemsToUseSoon(state)).toEqual(['Milk', 'beef mince']);
  });

  it('does not unflag an item the scan reports as fine', () => {
    const state = mergeScan({ items: ['spinach'], useSoon: ['spinach'] }, [{ name: 'spinach', useSoon: false }]);
    expect(isUseSoon(state, 'spinach')).toBe(true);
  });

  it('adds trimmed manual items, skipping blanks and duplicates', () => {
    let state = addItem(empty, '  tasty cheese ');
    state = addItem(state, 'Tasty Cheese');
    state = addItem(state, '   ');
    expect(state.items).toEqual(['tasty cheese']);
  });

  it('keeps flags when other items are added and removed', () => {
    let state = toggleUseSoon({ items: ['eggs', 'spinach', 'milk'], useSoon: [] }, 'spinach');
    state = addItem(state, 'coconut milk');
    state = removeItem(state, 0);
    expect(state.items).toEqual(['spinach', 'milk', 'coconut milk']);
    expect(itemsToUseSoon(state)).toEqual(['spinach']);
  });

  it('drops the flag when its item is removed, so re-adding starts unflagged', () => {
    let state = toggleUseSoon({ items: ['spinach'], useSoon: [] }, 'spinach');
    state = removeItem(state, 0);
    expect(state.useSoon).toEqual([]);
    expect(isUseSoon(addItem(state, 'spinach'), 'spinach')).toBe(false);
  });

  it('toggles a flag on and off', () => {
    const on = toggleUseSoon({ items: ['milk'], useSoon: [] }, 'milk');
    expect(isUseSoon(on, 'MILK')).toBe(true);
    expect(isUseSoon(toggleUseSoon(on, 'milk'), 'milk')).toBe(false);
  });

  it('ignores an out-of-range remove', () => {
    const state = { items: ['milk'], useSoon: ['milk'] };
    expect(removeItem(state, 5)).toBe(state);
  });
});
