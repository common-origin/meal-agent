import { describe, it, expect, vi, beforeEach } from 'vitest';

const exchangeCodeForSessionMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      exchangeCodeForSession: exchangeCodeForSessionMock,
    },
  })),
}));

import { GET } from '../route';

describe('auth callback route', () => {
  beforeEach(() => {
    exchangeCodeForSessionMock.mockReset();
  });

  it('exchanges the code and redirects to /plan when there is no next param', async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });

    const response = await GET(
      new Request('https://example.com/auth/callback?code=abc123')
    );

    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith('abc123');
    expect(response.headers.get('location')).toBe('https://example.com/plan');
  });

  it('redirects to the safe next path when one is provided', async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });

    const response = await GET(
      new Request(
        'https://example.com/auth/callback?code=abc123&next=%2Frecipes%2F42'
      )
    );

    expect(response.headers.get('location')).toBe(
      'https://example.com/recipes/42'
    );
  });

  it('falls back to /plan when next is not a safe same-origin path', async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });

    const response = await GET(
      new Request(
        'https://example.com/auth/callback?code=abc123&next=https%3A%2F%2Fevil.example.com'
      )
    );

    expect(response.headers.get('location')).toBe('https://example.com/plan');
  });

  it('redirects to /login?error=auth_failed when the code exchange fails', async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      error: new Error('bad code'),
    });

    const response = await GET(
      new Request('https://example.com/auth/callback?code=abc123')
    );

    expect(response.headers.get('location')).toBe(
      'https://example.com/login?error=auth_failed'
    );
  });

  it('redirects to /plan without calling exchangeCodeForSession when there is no code', async () => {
    const response = await GET(
      new Request('https://example.com/auth/callback')
    );

    expect(exchangeCodeForSessionMock).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toBe('https://example.com/plan');
  });
});
