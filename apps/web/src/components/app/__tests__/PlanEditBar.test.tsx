import { describe, it, expect, vi } from 'vitest';
import { createRef, useState, type Ref } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AgentInputHandle } from '@common-origin/design-system';
import PlanEditBar, { PLAN_EDIT_MAX_LENGTH, type PlanEditBarProps } from '../PlanEditBar';

function Harness({ inputRef, ...props }: Partial<PlanEditBarProps> & { inputRef?: Ref<AgentInputHandle> }) {
  const [value, setValue] = useState(props.value ?? '');
  return (
    <PlanEditBar
      ref={inputRef}
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

  it("can't send an empty instruction, or one past the edit API's limit", () => {
    render(<Harness />);
    expect(send()).toBeDisabled();
    fireEvent.change(input(), { target: { value: 'x'.repeat(PLAN_EDIT_MAX_LENGTH + 1) } });
    expect(send()).toBeDisabled();
  });

  it("shows the plan's own helper, never banking copy", () => {
    render(<Harness />);
    expect(screen.getByText('Change any night, add one or drop one. Press Enter to send.')).toBeInTheDocument();
    expect(screen.queryByText(/transactions/i)).toBeNull();
  });

  it('offers Accept and Discard in the review bar once every proposed night is ready', () => {
    const onAccept = vi.fn();
    const onDiscard = vi.fn();
    render(
      <Harness
        preview={{ id: '1', changeCount: 2, pending: false }}
        onAccept={onAccept}
        onDiscard={onDiscard}
        message={{ text: 'Swapping Tuesday and Thursday.', tone: 'info' }}
      />
    );
    expect(screen.getByText('Swapping Tuesday and Thursday.')).toBeInTheDocument();
    expect(screen.getByText('2 nights change')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onAccept).toHaveBeenCalled();
    expect(onDiscard).toHaveBeenCalled();
  });

  it('holds Accept back while a proposed night is still generating', () => {
    render(<Harness preview={{ id: '1', changeCount: 1, pending: true }} />);
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull();
    expect(screen.getByText('Finding new dinners…')).toBeInTheDocument();
  });

  it('offers Undo after an accepted edit', () => {
    const onUndo = vi.fn();
    render(<Harness canUndo onUndo={onUndo} message={{ text: 'Updated 1 night.', tone: 'info' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalled();
  });

  it("exposes AgentInput's handle, so Change on a meal can focus the field", () => {
    const ref = createRef<AgentInputHandle>();
    render(<Harness inputRef={ref} value="Tuesday: " />);
    act(() => ref.current?.focus({ cursor: 'end' }));
    expect(input()).toHaveFocus();
  });
});
