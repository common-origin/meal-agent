import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import RateRecipeModal from '../RateRecipeModal';

const saveButton = () => screen.getByRole('button', { name: 'Save rating' });
const star = (n: number) => screen.getByRole('button', { name: `Rate ${n} star${n === 1 ? '' : 's'}` });

function renderModal(props: Partial<React.ComponentProps<typeof RateRecipeModal>> = {}) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <RateRecipeModal isOpen recipeTitle="Butter Chicken" rating={0} onSave={onSave} onClose={onClose} {...props} />
  );
  return { onSave, onClose, ...view };
}

describe('RateRecipeModal', () => {
  it('keeps Save disabled until a star is picked, then saves the picked rating', () => {
    const { onSave } = renderModal();
    expect(saveButton()).toBeDisabled();
    fireEvent.click(star(4));
    expect(onSave).not.toHaveBeenCalled(); // a star only sets the draft
    expect(saveButton()).toBeEnabled();
    fireEvent.click(saveButton());
    expect(onSave).toHaveBeenCalledWith(4);
  });

  it('starts from the saved rating', () => {
    renderModal({ rating: 3 });
    expect(screen.getByRole('group', { name: 'Rating: 3 of 5' })).toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });

  it('discards the draft on Cancel, and starts from the saved rating when reopened', () => {
    const { onSave, onClose, rerender } = renderModal({ rating: 2 });
    fireEvent.click(star(5));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();

    rerender(<RateRecipeModal isOpen={false} recipeTitle="Butter Chicken" rating={2} onSave={onSave} onClose={onClose} />);
    rerender(<RateRecipeModal isOpen recipeTitle="Butter Chicken" rating={2} onSave={onSave} onClose={onClose} />);
    expect(screen.getByRole('group', { name: 'Rating: 2 of 5' })).toBeInTheDocument();
  });
});
