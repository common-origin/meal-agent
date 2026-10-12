import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/storage', () => ({ isFavorite: () => false, toggleFavorite: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));

import MealCard from '../MealCard';

const base = { recipeId: 'ai-soup-1234abcd', title: 'Pumpkin soup', chef: '', timeMins: 30, disableLink: true };
const LINE = "Uses your pumpkin before it goes soft, and it's ready in 30 minutes.";

describe('MealCard "why this meal" line (#94)', () => {
  it('renders the explanation when given', () => {
    render(<MealCard {...base} explanation={LINE} />);
    expect(screen.getByText(LINE)).toBeInTheDocument();
  });

  it('renders nothing extra without one', () => {
    const { container } = render(<MealCard {...base} />);
    const withLine = render(<MealCard {...base} explanation={LINE} />).container;
    expect(container.textContent).not.toContain('Uses your');
    expect(withLine.textContent?.length).toBe((container.textContent?.length ?? 0) + LINE.length);
  });

});
