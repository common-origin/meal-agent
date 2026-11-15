import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import StarRating from '../StarRating';

const stars = () => [1, 2, 3, 4, 5].map((n) => screen.getByRole('button', { name: `Rate ${n} star${n === 1 ? '' : 's'}` }));
const filled = () => stars().map((star) => star.getAttribute('data-filled'));

describe('StarRating', () => {
  it('fills the stars up to the rating and states it on the group', () => {
    render(<StarRating rating={3} onChange={() => {}} />);
    expect(filled()).toEqual(['true', 'true', 'true', 'false', 'false']);
    expect(screen.getByRole('group', { name: 'Rating: 3 of 5' })).toBeInTheDocument();
  });

  it('shows no filled stars before a rating', () => {
    render(<StarRating rating={0} onChange={() => {}} />);
    expect(filled()).toEqual(['false', 'false', 'false', 'false', 'false']);
    expect(screen.getByRole('group', { name: 'Not rated yet' })).toBeInTheDocument();
  });

  it('previews a rating on hover and on keyboard focus, then goes back to the saved one', () => {
    render(<StarRating rating={1} onChange={() => {}} />);
    fireEvent.mouseEnter(stars()[3]);
    expect(filled()).toEqual(['true', 'true', 'true', 'true', 'false']);
    fireEvent.mouseLeave(screen.getByRole('group'));
    expect(filled()).toEqual(['true', 'false', 'false', 'false', 'false']);

    fireEvent.focus(stars()[2]);
    expect(filled()).toEqual(['true', 'true', 'true', 'false', 'false']);
    fireEvent.blur(stars()[2]);
    expect(filled()).toEqual(['true', 'false', 'false', 'false', 'false']);
  });

  it('rates with the star clicked', () => {
    const onChange = vi.fn();
    render(<StarRating rating={0} onChange={onChange} />);
    fireEvent.click(stars()[4]);
    expect(onChange).toHaveBeenCalledWith(5);
  });
});
