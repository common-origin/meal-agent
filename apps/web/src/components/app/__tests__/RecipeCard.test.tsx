import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

vi.mock('@/lib/storage', () => ({ isFavorite: () => false, toggleFavorite: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));

import MealCard, { MealCardSkeleton } from '../MealCard';
import MealMenu from '../MealMenu';

const base = { recipeId: 'ai-coq-1', title: 'Coq au Vin', chef: 'Jamie Oliver', timeMins: 45 };

describe('recipe card structure (#180)', () => {
  it('makes the title the link, named by the title alone, with no control inside it', () => {
    const { container } = render(<MealCard {...base} reasons={['quick']} onDeleteClick={() => {}} />);
    const link = screen.getByRole('link', { name: 'Coq au Vin' });
    expect(link).toHaveAttribute('href', '/recipe/ai-coq-1');
    expect(container.querySelectorAll('a button, button a, a a, button button')).toHaveLength(0);
    // ⋮ is its own control, beside the link
    expect(screen.getByRole('button', { name: 'More options for Coq au Vin' })).toBeInTheDocument();
  });

  it('in the swap drawer, the title is a button that picks the recipe', () => {
    const onSwapClick = vi.fn();
    render(<MealCard {...base} disableLink onSwapClick={onSwapClick} />);
    expect(screen.queryByRole('link')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Use Coq au Vin' }));
    expect(onSwapClick).toHaveBeenCalledTimes(1);
  });
});

describe('recipe card content (#181)', () => {
  it('shows the title exactly as stored', () => {
    render(<MealCard {...base} />);
    expect(screen.getByRole('heading', { name: 'Coq au Vin' })).toBeInTheDocument();
  });

  it('leads the details line with the time, then nutrition, then the source', () => {
    const { container } = render(<MealCard {...base} nutrition={{ calories: 520, protein: 24, carbs: 0, fat: 0 }} />);
    expect(container.textContent).toContain('45 min · 520 cal · 24g protein · Jamie Oliver');
  });

  it('flags a long cook', () => {
    render(<MealCard {...base} timeMins={150} />);
    expect(screen.getByText('150 min · long cook')).toBeInTheDocument();
  });

  it('shows no time or source when they are unknown, rather than inventing them', () => {
    const { container } = render(<MealCard {...base} chef="" timeMins={0} />);
    expect(container.textContent).not.toMatch(/\bmin\b/);
    expect(container.textContent).not.toContain('·');
  });

  it('puts the reason chips on their own row, spelt "Your favourite"', () => {
    render(<MealCard {...base} reasons={['favorite', 'quick']} />);
    expect(screen.getByText('Your favourite')).toBeInTheDocument();
    expect(screen.getByText('Quick')).toBeInTheDocument();
  });

  it('has a decorative loading skeleton', () => {
    render(<MealCardSkeleton />);
    expect(screen.getByTestId('meal-card-skeleton')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('MealMenu destructive label (#179)', () => {
  const open = () => fireEvent.click(screen.getByRole('button', { name: 'More options for Soup' }));

  it('says "Remove from plan" by default (the plan)', () => {
    render(<MealMenu recipeId="r1" title="Soup" onDeleteClick={() => {}} />);
    open();
    expect(screen.getByText('Remove from plan')).toBeInTheDocument();
  });

  it('says what it really does where it is used', () => {
    const onDeleteClick = vi.fn();
    render(<MealMenu recipeId="r1" title="Soup" onDeleteClick={onDeleteClick} deleteLabel="Delete recipe" />);
    open();
    expect(screen.queryByText('Remove from plan')).toBeNull();
    fireEvent.click(within(document.body).getByText('Delete recipe'));
    expect(onDeleteClick).toHaveBeenCalledTimes(1);
  });
});
