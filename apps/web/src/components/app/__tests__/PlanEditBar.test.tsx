import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import PlanEditBar, { type PlanEditBarProps } from '../PlanEditBar';

function Harness(props: Partial<PlanEditBarProps> & { onSubmit?: (text: string) => void }) {
  const [value, setValue] = useState(props.value ?? '');
  return (
    <PlanEditBar
      previewOpen={false}
      acceptCount={0}
      acceptPending={false}
      onAccept={() => {}}
      onDiscard={() => {}}
      canUndo={false}
      onUndo={() => {}}
      busy={false}
      {...props}
      value={value}
      onChange={setValue}
      onSubmit={props.onSubmit ?? (() => {})}
    />
  );
}

const input = () => screen.getByRole('textbox', { name: 'Tell me what to change' });

describe('PlanEditBar (#38)', () => {
  it('sends the trimmed instruction', () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    fireEvent.change(input(), { target: { value: '  swap Tuesday for something lighter ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSubmit).toHaveBeenCalledWith('swap Tuesday for something lighter');
  });

  it("asks for an instruction instead of sending an empty one, and clears that once you type", () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Type what you'd like to change first.")).toBeInTheDocument();
    fireEvent.change(input(), { target: { value: 'T' } });
    expect(screen.queryByText("Type what you'd like to change first.")).toBeNull();
  });

  it('shows the reply line, and Accept and Discard while a preview is open', () => {
    const onAccept = vi.fn();
    const onDiscard = vi.fn();
    render(
      <Harness
        previewOpen
        acceptCount={2}
        onAccept={onAccept}
        onDiscard={onDiscard}
        message={{ text: 'Swapping Tuesday and Thursday.', tone: 'info' }}
      />
    );
    expect(screen.getByText('Swapping Tuesday and Thursday.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Accept 2 changes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onAccept).toHaveBeenCalled();
    expect(onDiscard).toHaveBeenCalled();
  });

  it('holds Accept while a proposed night is still generating', () => {
    render(<Harness previewOpen acceptCount={1} acceptPending />);
    expect(screen.getByRole('button', { name: 'Generating...' })).toBeDisabled();
  });

  it('offers Undo after an accepted edit', () => {
    const onUndo = vi.fn();
    render(<Harness canUndo onUndo={onUndo} message={{ text: 'Updated 1 night.', tone: 'info' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalled();
  });
});
