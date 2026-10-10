import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiErrorMessage, GENERIC_ERROR_MESSAGE, redirectToLoginIfUnauthenticated } from '../api/client';

describe('redirectToLoginIfUnauthenticated', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends a 401 to login with the current path as redirectTo', () => {
    window.history.pushState({}, '', '/recipes/add?tab=url');
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {});
    expect(redirectToLoginIfUnauthenticated(new Response(null, { status: 401 }))).toBe(true);
    expect(assign).toHaveBeenCalledWith('/login?redirectTo=%2Frecipes%2Fadd');
  });

  it.each([200, 400, 429, 500])('leaves a %i response to the caller', (status) => {
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {});
    expect(redirectToLoginIfUnauthenticated(new Response(null, { status }))).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });
});

describe('apiErrorMessage (#96)', () => {
  it('uses the route\'s friendly error', () => {
    expect(apiErrorMessage({ error: 'That took too long. Please try again.', code: 'timeout' })).toBe(
      'That took too long. Please try again.'
    );
  });

  it.each([null, undefined, 'An error occurred with your deployment', {}, { error: '' }, { error: 42 }, { details: 'raw' }])(
    'falls back to generic copy for %j',
    (data) => {
      expect(apiErrorMessage(data)).toBe(GENERIC_ERROR_MESSAGE);
    }
  );
});
