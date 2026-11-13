import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import TextListField, { addListItem, MAX_TEXT_LIST_ITEMS } from '../TextListField';

describe('addListItem', () => {
  it('adds a trimmed item', () => {
    expect(addListItem(['peanuts'], '  shellfish ')).toEqual(['peanuts', 'shellfish']);
  });

  it('ignores blanks and case-insensitive duplicates', () => {
    const values = ['Peanuts'];
    expect(addListItem(values, '   ')).toBe(values);
    expect(addListItem(values, 'peanuts')).toBe(values);
  });

  it('stops at the item cap', () => {
    const full = Array.from({ length: MAX_TEXT_LIST_ITEMS }, (_, i) => `item ${i}`);
    expect(addListItem(full, 'one more')).toBe(full);
  });
});

describe('TextListField', () => {
  it('adds an item on Enter and clears the field', () => {
    const onChange = vi.fn();
    render(<TextListField label="Allergies" values={[]} onChange={onChange} />);
    const input = screen.getByLabelText('Allergies') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'sesame' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['sesame']);
    expect(input.value).toBe('');
  });

  it('removes an item when its chip is dismissed', () => {
    const onChange = vi.fn();
    render(<TextListField label="Allergies" values={['peanuts', 'sesame']} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole('button', { name: /remove/i })[0]);
    expect(onChange).toHaveBeenCalledWith(['sesame']);
  });
});
