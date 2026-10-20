import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PlanEditBar, { type PlanEditBarProps } from '../PlanEditBar';

function Harness(props: Partial<PlanEditBarProps>) {
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
      onSubmit={props.onSubmit ?? (async () => {})}
    />
  );
}

const input = () => screen.getByRole('textbox', { name: 'Tell me what to change' });
const send = () => screen.getByRole('button', { name: 'Send message' });

describe('PlanEditBar (#38), built on the design system AgentInput', () => {
  it('sends the trimmed instruction, then clears the field once it is handled', async () => {
    const onSubmit = vi.fn(async () => {});
    render(<Harness onSubmit={onSubmit} />);
    fireEvent.change(input(), { target: { value: '  swap Tuesday for something lighter ' } });
    fireEvent.click(send());
    expect(onSubmit).toHaveBeenCalledWith('swap Tuesday for something lighter');
    await waitFor(() => expect(input()).toHaveValue(''));
  });

  it('keeps the typed instruction and shows the error when the request fails', async () => {
    function Failing() {
      const [message, setMessage] = useState<PlanEditBarProps['message']>(null);
      return (
        <Harness
          message={message}
          onSubmit={async () => {
            setMessage({ text: 'That took too long. Please try again.', tone: 'error' });
            throw new Error('timeout');
          }}
        />
      );
    }
    render(<Failing />);
    fireEvent.change(input(), { target: { value: 'swap Tuesday' } });
    fireEvent.click(send());
    expect(await screen.findByText('That took too long. Please try again.')).toBeInTheDocument();
    expect(input()).toHaveValue('swap Tuesday');
  });

  it("can't send an empty instruction", () => {
    render(<Harness />);
    expect(send()).toBeDisabled();
  });

  it("shows the plan's own helper, never AgentInput's default banking copy", () => {
    render(<Harness />);
    expect(screen.getByText('Change any night, add one or drop one. Press Enter to send.')).toBeInTheDocument();
    expect(screen.queryByText(/transactions/i)).toBeNull();
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
