import { describe, it, expect } from 'vitest';
import { distinctTags, isLongCook, LONG_COOK_MINS, weekDateLabels } from '../dayCard';

describe('isLongCook (#160)', () => {
  it('flags meals over the threshold, not at it', () => {
    expect(LONG_COOK_MINS).toBe(60);
    expect(isLongCook(60)).toBe(false);
    expect(isLongCook(61)).toBe(true);
    expect(isLongCook(30)).toBe(false);
  });
});

describe('distinctTags (#160)', () => {
  it('hides a tag every planned meal shares and keeps one only some have', () => {
    const result = distinctTags([
      null,
      ['Kid-friendly'],
      ['Kid-friendly'],
      ['Kid-friendly', 'Bulk cook'],
      null,
    ]);
    expect(result).toEqual([null, [], [], ['Bulk cook'], null]);
  });

  it('keeps every tag when only one meal is planned', () => {
    expect(distinctTags([null, ['Kid-friendly', 'Quick'], null])).toEqual([null, ['Kid-friendly', 'Quick'], null]);
  });

  it('keeps a tag one meal lacks, even when the rest share it', () => {
    expect(distinctTags([['Kid-friendly'], ['Kid-friendly'], []])).toEqual([['Kid-friendly'], ['Kid-friendly'], []]);
  });
});

describe('weekDateLabels (#160)', () => {
  it('labels Monday to Sunday, across a month end', () => {
    expect(weekDateLabels('2026-10-26')).toEqual(['26 Oct', '27 Oct', '28 Oct', '29 Oct', '30 Oct', '31 Oct', '1 Nov']);
  });
});
