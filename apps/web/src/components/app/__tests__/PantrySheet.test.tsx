import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import PantrySheet from '../PantrySheet';
import type { PantryState } from '@/lib/pantryItems';

function Harness({ initial }: { initial: PantryState }) {
  const [pantry, setPantry] = useState(initial);
  return (
    <PantrySheet
      isOpen
      onClose={() => {}}
      pantry={pantry}
      onUpdatePantry={setPantry}
      onScanImage={() => {}}
      isScanning={false}
      scanError={null}
    />
  );
}

const useSoonChip = (item: string) => screen.getByRole('checkbox', { name: `Use ${item} soon` });

describe('PantrySheet use-soon toggle', () => {
  it('survives adding and removing other pantry items', () => {
    render(<Harness initial={{ items: ['eggs', 'spinach', 'milk'], useSoon: [] }} />);

    fireEvent.click(useSoonChip('spinach'));
    expect(useSoonChip('spinach')).toHaveAttribute('aria-checked', 'true');

    fireEvent.change(screen.getByLabelText('Ingredient'), { target: { value: 'coconut milk' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]); // eggs

    expect(screen.queryByText('• eggs')).toBeNull();
    expect(useSoonChip('spinach')).toHaveAttribute('aria-checked', 'true');
    expect(useSoonChip('milk')).toHaveAttribute('aria-checked', 'false');
    expect(useSoonChip('coconut milk')).toHaveAttribute('aria-checked', 'false');
  });
});
