// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const insert = vi.fn();
const rpc = vi.fn();
const createAdminClient = vi.fn(() => ({ from: () => ({ insert }) }));
const createClient = vi.fn(async () => ({ rpc }));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => createAdminClient(),
  createClient: () => createClient(),
}));
// after() only works inside a request: run the work straight away and let tests await it.
const pending: Promise<void>[] = [];
vi.mock('@/lib/adminAlerts', () => ({
  runAfterResponse: (work: () => Promise<void>) => {
    pending.push(work().catch(() => {}));
  },
}));

import { reportErrorAfterResponse, reportErrorNow } from '../report';
import { AiTaskError } from '@/lib/ai/run';
import { onRequestError } from '../../../instrumentation';

const flush = () => Promise.all(pending.splice(0));

beforeEach(() => {
  insert.mockReset().mockResolvedValue({ error: null });
  rpc.mockReset().mockResolvedValue({ data: null });
  createAdminClient.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('reportErrorNow', () => {
  it('logs one app_error line and inserts one row', async () => {
    await reportErrorNow({ source: 'server', route: '/app/plan', error: new Error('boom') });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0]?.[0]).toMatchObject({ source: 'server', route: '/app/plan', message: 'boom' });
    const logged = vi.mocked(console.error).mock.calls.map((c) => String(c[0])).filter((l) => l.includes('"app_error"'));
    expect(logged).toHaveLength(1);
    expect(logged[0]).not.toContain('household_id');
  });

  it('skips an AiTaskError, which runAiTask already recorded', async () => {
    await reportErrorNow({ source: 'server', error: new AiTaskError('timeout', 'slow') });
    expect(insert).not.toHaveBeenCalled();
  });

  it('warns, and does not throw, when the table is missing', async () => {
    insert.mockResolvedValue({ error: { message: 'relation "public.app_errors" does not exist' } });
    await expect(reportErrorNow({ source: 'server', error: new Error('x') })).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('migration 019'), expect.any(String));
  });

  it('does not throw when the admin client cannot be created', async () => {
    createAdminClient.mockImplementationOnce(() => {
      throw new Error('Missing Supabase service role key');
    });
    await expect(reportErrorNow({ source: 'server', error: new Error('x') })).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalled();
  });
});

describe('reportErrorAfterResponse', () => {
  it('inserts one source=route row with its label and the session household', async () => {
    rpc.mockResolvedValue({ data: 'hh-1' });
    reportErrorAfterResponse({ source: 'route', route: '/api/coles-search', label: 'coles-search: lookup failed', error: new Error('x') });
    await flush();
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0]?.[0]).toMatchObject({ source: 'route', label: 'coles-search: lookup failed', household_id: 'hh-1' });
  });

  it('uses an explicit household without looking one up', async () => {
    reportErrorAfterResponse({ source: 'route', error: new Error('x'), householdId: 'hh-2' });
    await flush();
    expect(rpc).not.toHaveBeenCalled();
    expect(insert.mock.calls[0]?.[0]).toMatchObject({ household_id: 'hh-2' });
  });

  it('still records the error, without a household, when there is no session', async () => {
    createClient.mockRejectedValueOnce(new Error('cookies() outside a request'));
    reportErrorAfterResponse({ source: 'route', error: new Error('x') });
    await flush();
    expect(insert.mock.calls[0]?.[0]).toMatchObject({ household_id: null });
  });

  it('produces no row for an AiTaskError', async () => {
    reportErrorAfterResponse({ source: 'route', error: new AiTaskError('billing', 'credits') });
    await flush();
    expect(insert).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('never throws, even when the insert rejects', async () => {
    insert.mockRejectedValue(new Error('network'));
    expect(() => reportErrorAfterResponse({ source: 'route', error: new Error('x') })).not.toThrow();
    await flush();
    expect(console.warn).toHaveBeenCalled();
  });
});

describe('onRequestError (instrumentation)', () => {
  it('stores context.routePath, never request.path, and awaits the write', async () => {
    let finished = false;
    insert.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 5));
      finished = true;
      return { error: null };
    });
    const error = Object.assign(new Error('render failed'), { digest: '99887766' });
    await onRequestError(
      error,
      { path: '/api/plan/ics/3f2b8c1e-9a47-4d6e-b0a1-5c7d2e8f9a10?x=jane@example.com', method: 'GET', headers: {} },
      {
        routerKind: 'App Router',
        routePath: '/app/api/plan/ics/[token]',
        routeType: 'route',
        renderSource: undefined,
        revalidateReason: undefined,
        renderType: undefined,
      } as never
    );
    expect(finished).toBe(true);
    expect(insert).toHaveBeenCalledTimes(1);
    const row = insert.mock.calls[0]?.[0];
    expect(row).toMatchObject({ source: 'server', route: '/app/api/plan/ics/[token]', digest: '99887766' });
    expect(row.context).toMatchObject({ method: 'GET', routeType: 'route' });
    expect(JSON.stringify(row)).not.toContain('3f2b8c1e');
    expect(JSON.stringify(row)).not.toContain('jane');
  });
});
