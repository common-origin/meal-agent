import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/lib/library', () => ({ RecipeLibrary: { getById: () => undefined } }));

import PlanDetailsSheet from '../PlanDetailsSheet';

const summary = { cost: 118, budget: 140, dinners: 7, roughCost: false, nutrition: { calories: 520, protein: 34, carbs: 48, fat: 18, meals: 6 } };
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

describe('PlanDetailsSheet (#38)', () => {
  it('shows the budget and the average nutrition per serve, and closes', () => {
    const onClose = vi.fn();
    render(<PlanDetailsSheet isOpen onClose={onClose} weekPlan={Array(7).fill(null)} summary={summary} dayNames={DAYS} />);
    expect(screen.getByText('Weekly budget')).toBeInTheDocument();
    expect(screen.getByText('Based on 6 of 7 dinners with nutrition data.')).toBeInTheDocument();
    expect(screen.getByText('520')).toBeInTheDocument();
    expect(screen.getByText('34g')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close plan details' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('says so when no dinner has nutrition data', () => {
    render(<PlanDetailsSheet isOpen onClose={() => {}} weekPlan={[]} summary={{ ...summary, nutrition: null }} dayNames={DAYS} />);
    expect(screen.getByText("No nutrition data for this week's dinners yet.")).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<PlanDetailsSheet isOpen={false} onClose={() => {}} weekPlan={[]} summary={summary} dayNames={DAYS} />);
    expect(container).toBeEmptyDOMElement();
  });
});
