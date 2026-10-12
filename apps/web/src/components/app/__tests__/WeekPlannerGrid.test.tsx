import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/lib/storage', () => ({ isFavorite: () => false, toggleFavorite: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));

import WeekPlannerGrid from '../WeekPlannerGrid';
import type { MealCardProps } from '../MealCard';

const meal = (title: string): MealCardProps => ({ recipeId: `ai-${title}`, title, chef: '', timeMins: 30 });

describe('WeekPlannerGrid progressive generation (#95)', () => {
  it('shows finished days while others are still generating, and a retry on a failed day', () => {
    const onRetryDay = vi.fn();
    const meals = [meal('Pumpkin soup'), null, null, null, null, null, null];
    render(
      <WeekPlannerGrid
        meals={meals}
        generatingDays={[1, 2, 3, 4, 5]}
        dayErrors={{ 6: 'That took too long. Please try again.' }}
        onRetryDay={onRetryDay}
      />
    );

    expect(screen.getByText('Pumpkin soup')).toBeInTheDocument();
    expect(screen.getByLabelText('Generating AI recipe for Tuesday')).toBeInTheDocument();
    expect(screen.getByLabelText('Generating AI recipe for Saturday')).toBeInTheDocument();
    expect(screen.queryByLabelText('Generating AI recipe for Monday')).toBeNull();
    expect(screen.getByText('That took too long. Please try again.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry this day' }));
    expect(onRetryDay).toHaveBeenCalledWith(6);
  });

  it('hides Retry while it is unavailable (e.g. a week is still generating)', () => {
    render(<WeekPlannerGrid meals={Array(7).fill(null)} dayErrors={{ 0: 'Something went wrong. Please try again.' }} />);
    expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry this day' })).toBeNull();
  });
});
