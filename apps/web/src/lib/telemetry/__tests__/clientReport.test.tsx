import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { buildClientErrorBody, reportClientError, resetClientReporting, MAX_PER_PAGE_LOAD } from '../clientReport';
import ErrorPage from '@/app/error';
import GlobalError from '@/app/global-error';

const fetchMock = vi.fn();

beforeEach(() => {
  resetClientReporting();
  fetchMock.mockReset().mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', fetchMock);
  window.history.pushState({}, '', '/plan');
});
afterEach(() => vi.unstubAllGlobals());

const sentBodies = () => fetchMock.mock.calls.map((c) => JSON.parse(c[1].body as string));

describe('reportClientError (#246)', () => {
  it('sends one report with a route pattern, a scrubbed message and the top frame', () => {
    window.history.pushState({}, '', '/recipe/ai-quick-lemon-chicken-skillet?week=2026-11-16&email=jane@example.com');
    const error = new TypeError('cannot read jane@example.com of https://x.test/a?b=1');
    reportClientError(error);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/telemetry/client-error');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', keepalive: true });
    const [body] = sentBodies();
    expect(body).toMatchObject({ kind: 'TypeError', route: '/recipe/[param]', message: 'cannot read [email] of [url]' });
    expect(JSON.stringify(body)).not.toContain('lemon');
    expect(JSON.stringify(body)).not.toContain('jane');
    expect(JSON.stringify(body)).not.toContain('?');
    expect(Object.keys(body).every((k) => ['kind', 'message', 'route', 'topFrame'].includes(k))).toBe(true);
  });

  it('sends a duplicate once per page load', () => {
    reportClientError(new Error('boom'));
    reportClientError(new Error('boom'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it(`sends at most ${MAX_PER_PAGE_LOAD} reports per page load`, () => {
    for (let i = 0; i < 12; i++) reportClientError(new Error(`distinct problem ${'abcdefghijkl'[i]}`));
    expect(fetchMock).toHaveBeenCalledTimes(MAX_PER_PAGE_LOAD);
  });

  it('skips an error with a digest: onRequestError already has it', () => {
    reportClientError(new Error('server render failed'), { digest: '12345' });
    reportClientError(Object.assign(new Error('server render failed too'), { digest: '678' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignores browser noise and never throws, even if fetch does', () => {
    reportClientError(new Error('ResizeObserver loop completed with undelivered notifications.'));
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockImplementation(() => {
      throw new Error('offline');
    });
    expect(() => reportClientError(new Error('another'))).not.toThrow();
    fetchMock.mockRejectedValue(new Error('network'));
    expect(() => reportClientError(new Error('and another'))).not.toThrow();
  });

  it('reports a non-Error rejection reason', () => {
    reportClientError('plain string reason');
    expect(sentBodies()[0]).toMatchObject({ kind: 'Error', message: 'plain string reason' });
  });

  it('buildClientErrorBody sends only the top stack frame', () => {
    const error = new Error('x');
    error.stack = 'Error: x\n    at a (https://app.test/_next/static/chunks/main.js?v=1:10:5)\n    at b (https://app.test/other.js:2:2)';
    expect(buildClientErrorBody(error, '/plan').topFrame).toBe('chunks/main.js:10');
  });
});

describe('error pages (#246)', () => {
  it('app/error reports a client error once and offers retry', () => {
    const retry = vi.fn();
    const { getByRole } = render(<ErrorPage error={new Error('render blew up')} retry={retry} />);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentBodies()[0]).toMatchObject({ message: 'render blew up', route: '/plan' });
    getByRole('button', { name: 'Try again' }).click();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('app/error does not report a server error (it has a digest)', () => {
    render(<ErrorPage error={Object.assign(new Error('An error occurred in the Server Components render.'), { digest: '99' })} retry={() => {}} />);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('app/error does not double-report an error the window listener already sent', () => {
    const error = new Error('thrown in an effect');
    reportClientError(error);
    render(<ErrorPage error={error} retry={() => {}} />);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('global-error reports a client error and offers retry', () => {
    const retry = vi.fn();
    const { getByRole } = render(<GlobalError error={new Error('layout blew up')} retry={retry} />, { container: document.createElement('div') });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    getByRole('button', { name: 'Try again' }).click();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('global-error does not report a server error (it has a digest)', () => {
    render(<GlobalError error={Object.assign(new Error('x'), { digest: '1' })} retry={() => {}} />, { container: document.createElement('div') });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
