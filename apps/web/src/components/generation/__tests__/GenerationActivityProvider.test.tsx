import { describe, it, expect, vi } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import { GenerationActivityProvider, useGenerationActivity } from '../GenerationActivityProvider';

// The repo's first rendered tests: these failed outright while react and
// react-dom were on different versions (#74).

function wrapper({ children }: { children: React.ReactNode }) {
  return <GenerationActivityProvider>{children}</GenerationActivityProvider>;
}

describe('GenerationActivityProvider', () => {
  it('tracks overlapping generations through the hook', () => {
    const { result } = renderHook(() => useGenerationActivity(), { wrapper });
    expect(result.current.isGenerationInProgress).toBe(false);

    act(() => {
      result.current.beginGeneration();
      result.current.beginGeneration();
    });
    expect(result.current.isGenerationInProgress).toBe(true);

    act(() => result.current.endGeneration());
    expect(result.current.isGenerationInProgress).toBe(true);

    act(() => result.current.endGeneration());
    expect(result.current.isGenerationInProgress).toBe(false);
  });

  it('tracks sign-out separately from generation', () => {
    const { result } = renderHook(() => useGenerationActivity(), { wrapper });

    act(() => result.current.beginSignOut());
    expect(result.current.isSignOutInProgress).toBe(true);
    expect(result.current.isGenerationInProgress).toBe(false);

    act(() => result.current.endSignOut());
    expect(result.current.isSignOutInProgress).toBe(false);
  });

  it('re-renders consumers when the state changes', () => {
    function SignOutButton() {
      const { isGenerationInProgress, beginGeneration } = useGenerationActivity();
      return (
        <button disabled={isGenerationInProgress} onClick={beginGeneration}>
          Sign out
        </button>
      );
    }

    render(<SignOutButton />, { wrapper });
    const button = screen.getByRole('button', { name: 'Sign out' });
    expect(button).toBeEnabled();

    act(() => button.click());
    expect(button).toBeDisabled();
  });

  it('throws a clear error when used outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useGenerationActivity())).toThrow(
      'useGenerationActivity must be used within a GenerationActivityProvider'
    );
    vi.restoreAllMocks();
  });
});
