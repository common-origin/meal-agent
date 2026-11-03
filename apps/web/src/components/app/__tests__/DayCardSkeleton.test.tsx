import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('@/lib/storage', () => ({ isFavorite: () => false, toggleFavorite: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));

import WeekPlanList from '../WeekPlanList';
import PlanMeal from '../PlanMeal';
import { MealSkeleton } from '../DayCard';
import type { MealCardProps } from '../MealCard';

const meal = (title: string): MealCardProps => ({ recipeId: `ai-${title}`, title, chef: '', timeMins: 30 });
const DATES = ['9 Nov', '10 Nov', '11 Nov', '12 Nov', '13 Nov', '14 Nov', '15 Nov'];

describe('day card loading state (#177)', () => {
  it('keeps the real day and date, and announces itself as a busy status', () => {
    render(<WeekPlanList meals={Array(7).fill(null)} dates={DATES} generatingDays={[0]} />);
    const card = screen.getByRole('article', { name: 'Monday 9 Nov' });
    const status = within(card).getByRole('status', { name: 'Generating AI recipe for Monday' });
    expect(status).toHaveAttribute('aria-busy', 'true');
  });

  it("shows placeholders only for the actions the loaded meal will have", () => {
    const { rerender } = render(<WeekPlanList meals={Array(7).fill(null)} generatingDays={[0]} onChangeClick={() => {}} />);
    const card = () => screen.getByRole('article', { name: 'Monday' });
    // Change and ⋮
    expect(within(card()).getAllByTestId('action-placeholder')).toHaveLength(2);
    // While a week generates there's no Change yet: just ⋮
    rerender(<WeekPlanList meals={Array(7).fill(null)} generatingDays={[0]} />);
    expect(within(card()).getAllByTestId('action-placeholder')).toHaveLength(1);
  });

  it('uses the same skeleton for the first load and for a proposal that is loading', () => {
    const { unmount } = render(<WeekPlanList meals={[]} isGeneratingPlan dates={DATES} />);
    expect(screen.getByRole('status', { name: 'Loading recipe for Sunday' })).toHaveAttribute('aria-busy', 'true');
    unmount();
    render(<WeekPlanList meals={[meal('Pumpkin soup'), null, null, null, null, null, null]} proposals={{ 0: { kind: 'replace', status: 'loading', token: 1 } }} />);
    expect(screen.getByRole('status', { name: 'Finding something new for Monday' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Pumpkin soup').tagName).toBe('S');
  });

  it('turns the pulse and the fade-in off under reduced motion', () => {
    const skeleton = render(<MealSkeleton label="Loading" />).container;
    const planMeal = render(<PlanMeal {...meal('Pumpkin soup')} tags={[]} disableLink />).container;
    const css = [...document.querySelectorAll('style')].map((style) => style.textContent).join('\n');
    const reducedMotionOff = (element: Element) =>
      [...element.classList].some((cls) =>
        new RegExp(String.raw`@media \(prefers-reduced-motion: ?reduce\)\{[^@]*\.${cls}\{animation: ?none`).test(css)
      );
    // A skeleton bar (pulses) and the meal's wrapper (fades in)
    const bar = skeleton.querySelector('[role=status] span')!;
    const fade = planMeal.firstElementChild!;
    expect(reducedMotionOff(bar)).toBe(true);
    expect(reducedMotionOff(fade)).toBe(true);
  });
});
