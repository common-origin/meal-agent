import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/lib/storage', () => ({ isFavorite: () => false, toggleFavorite: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));

import WeekPlanList from '../WeekPlanList';
import type { MealCardProps } from '../MealCard';

const meal = (title: string): MealCardProps => ({ recipeId: `ai-${title}`, title, chef: '', timeMins: 30 });

describe('WeekPlanList progressive generation (#95)', () => {
  it('shows finished days while others are still generating, and a retry on a failed day', () => {
    const onRetryDay = vi.fn();
    const meals = [meal('Pumpkin soup'), null, null, null, null, null, null];
    render(
      <WeekPlanList
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
    render(<WeekPlanList meals={Array(7).fill(null)} dayErrors={{ 0: 'Something went wrong. Please try again.' }} />);
    expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry this day' })).toBeNull();
  });
});

describe('WeekPlanList layout (#38)', () => {
  it('lists Monday to Sunday in order, with an empty night offering its actions', () => {
    const meals = [meal('Pumpkin soup'), null, null, null, null, null, meal('Roast chicken')];
    render(<WeekPlanList meals={meals} onGenerateClick={() => {}} onAddSavedRecipeClick={() => {}} />);
    const labels = screen.getAllByText(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/).map((el) => el.textContent);
    expect(labels).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
    expect(screen.getAllByText('No meal planned')).toHaveLength(5);
    expect(screen.getAllByRole('button', { name: 'Generate' })).toHaveLength(5);
  });

  it('shows a skeleton for every night while the plan first loads', () => {
    render(<WeekPlanList meals={[]} isGeneratingPlan />);
    expect(screen.getByLabelText('Loading recipe for Monday')).toBeInTheDocument();
    expect(screen.getByLabelText('Loading recipe for Sunday')).toBeInTheDocument();
  });
});

describe('WeekPlanList proposals from a typed edit (#38)', () => {
  it('shows a ready proposal in place, naming the meal it replaces, and a removal', () => {
    const meals = [meal('Pumpkin soup'), meal('Beef polenta'), null, null, null, null, null];
    render(
      <WeekPlanList
        meals={meals}
        proposals={{
          0: { kind: 'replace', status: 'ready', meal: meal('Vietnamese rice paper bowls') },
          1: { kind: 'remove' },
        }}
      />
    );
    expect(screen.getByText('Vietnamese rice paper bowls')).toBeInTheDocument();
    expect(screen.getByText('Pumpkin soup').tagName).toBe('S');
    expect(screen.getByText('Suggested')).toBeInTheDocument();
    expect(screen.getByText('Will be removed')).toBeInTheDocument();
  });

  it('shows a loading proposal and a failed one with Try again and Keep as is', () => {
    const onRetryProposal = vi.fn();
    const onKeepNight = vi.fn();
    render(
      <WeekPlanList
        meals={[meal('Pumpkin soup'), meal('Beef polenta'), null, null, null, null, null]}
        proposals={{
          0: { kind: 'replace', status: 'loading', token: 1 },
          1: { kind: 'replace', status: 'failed', error: 'That took too long. Please try again.' },
        }}
        onRetryProposal={onRetryProposal}
        onKeepNight={onKeepNight}
      />
    );
    expect(screen.getByLabelText('Finding something new for Monday')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetryProposal).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole('button', { name: 'Keep as is' }));
    expect(onKeepNight).toHaveBeenCalledWith(1);
  });

  it('"Change" on a meal reports its night', () => {
    const onChangeClick = vi.fn();
    render(<WeekPlanList meals={[null, null, meal('Roast chicken'), null, null, null, null]} onChangeClick={onChangeClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Change Roast chicken' }));
    expect(onChangeClick).toHaveBeenCalledWith(2);
  });
});
