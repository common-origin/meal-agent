import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
const push = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));

import AdminDashboard from '../AdminDashboard';
import { adminLinks } from '@/lib/admin/links';
import { ERROR_GROUP_LIMIT } from '@/lib/admin/format';
import type { DashboardData } from '@/lib/admin/queries';

const LINKS = adminLinks({ NEXT_PUBLIC_SUPABASE_URL: 'https://abcd1234.supabase.co' });
const NOW = '2026-11-18T12:07:00.000Z';
const SLOT = 15 * 60_000;
const t0 = Date.UTC(2026, 10, 18, 9, 0, 0);

const fixture = (over: Partial<DashboardData> = {}): DashboardData => ({
  range: '7d',
  household: null,
  generatedAt: NOW,
  attention: {
    ok: true,
    data: [
      {
        id: 'health-failing',
        severity: 'error',
        section: 'status',
        title: 'Health check failing',
        where: 'Status · gemini',
        since: '2026-11-18T11:00:00Z',
        window: 'latest check',
        message: 'The latest health check is failing: gemini',
        fix: ['gemini: top up the prepaid credits.', 'Run the Uptime workflow again.'],
        actions: [
          { label: 'See the check detail', target: 'section' },
          { label: 'Open Vercel logs', target: 'vercel-logs' },
        ],
      },
      {
        id: 'new-errors',
        severity: 'warning',
        section: 'errors',
        title: 'New error',
        where: 'Errors · /api/coles-search',
        since: '2026-11-18T10:00:00Z',
        window: 'last 24 hours',
        message: '1 new error in the last 24 hours: coles-search: lookup failed',
        fix: ['Open the error and read the message.'],
        actions: [
          { label: 'See the new errors', target: 'section' },
          { label: 'Open the Supabase SQL editor', target: 'supabase-sql' },
        ],
      },
    ],
  },
  status: {
    ok: true,
    data: {
      latest: { created_at: '2026-11-18T12:00:00Z', ok: false, release: 'abc1234', total_latency_ms: 321, checks: { database: { ok: true }, gemini: { ok: false, detail: 'billing_errors_last_hour', metrics: { billingErrors: 2 } } } },
      heartbeatStale: false,
      deployedRelease: 'def5678',
      uptime: {
        from: t0,
        to: t0 + 4 * SLOT,
        slots: [
          { start: t0, state: 'ok' },
          { start: t0 + SLOT, state: 'failing' },
          { start: t0 + 2 * SLOT, state: 'no_data' },
          { start: t0 + 3 * SLOT, state: 'no_data' },
        ],
        uptimePct: 50,
        noDataShare: 0.5,
        okSlots: 1,
        failingSlots: 1,
        noDataSlots: 2,
        possibleOutages: [{ start: t0 + 2 * SLOT, end: t0 + 4 * SLOT, slots: 2 }],
        outageNow: true,
        lastIncident: { start: t0 + SLOT, end: t0 + 4 * SLOT, slots: 3 },
        monitoringSince: null,
      },
    },
  },
  errors: {
    ok: true,
    data: [
      {
        fingerprint: 'f1',
        label: 'coles-search: lookup failed',
        kind: 'Error',
        message: 'RapidAPI responded [n]',
        route: '/api/coles-search',
        source: 'route',
        count: 4,
        count_24h: 4,
        count_7d: 4,
        first_seen: '2026-11-18T10:00:00Z',
        last_seen: '2026-11-18T11:30:00Z',
        releases: ['abc1234'],
        households: 2,
        latest: [{ created_at: '2026-11-18T11:30:00Z', release: 'abc1234', source: 'route', digest: null, context: { status: 429 } }],
      },
    ],
  },
  ai: {
    ok: true,
    data: {
      by_task: [{ task: 'generation', model: 'gemini-x', calls: 20, ok_calls: 18, p50_ms: 4000, p95_ms: 9000, avg_input_tokens: 1200, avg_output_tokens: 800, cost_usd: 0.4, statuses: { ok: 18, error: 2 }, top_errors: [{ code: 'http_503', count: 2 }] }],
      daily: [{ day: '2026-11-18', calls: 20, ok_calls: 18, cost_usd: 0.4 }],
      failures: [{ created_at: '2026-11-18T11:00:00Z', task: 'generation', model: 'gemini-x', status: 'error', error_code: 'http_503', latency_ms: 900 }],
      billing_errors: 0,
    },
  },
  cost: { ok: true, data: { spendTodayUsd: 1, capUsd: 5, monthToDateUsd: 10, projectedMonthUsd: 17, daysElapsed: 17.5, daysInMonth: 30, coles: { used: 850, limit: 1000, remaining: 150, month: '2026-11' } } },
  households: {
    ok: true,
    data: [
      { shortId: 'abcdef12', isYou: true, members: 2, pending_invites: 1, last_active: '2026-11-18T11:00:00Z', has_plan_this_week: true, settings_complete: true, ai_calls: 12, ai_cost_usd: 0.2, errors: 1, last3_generation_failed: false },
      { shortId: '12345678', isYou: false, members: 1, pending_invites: 0, last_active: null, has_plan_this_week: false, settings_complete: false, ai_calls: 0, ai_cost_usd: 0, errors: 0, last3_generation_failed: false },
    ],
  },
  cycle: {
    ok: true,
    data: {
      first_week: '2026-09-28',
      last_week: '2026-11-16',
      households_total: 2,
      weeks: [
        { week_start: '2026-11-16', composed: 2, recipes_ai: 5, recipes_imported: 1, recipes_user_added: 0 },
        { week_start: '2026-11-09', composed: 1, recipes_ai: 2, recipes_imported: 0, recipes_user_added: 1 },
      ],
      cuisines: { households: 2, avg: 3.5, max: 5 },
      events: {
        available: true,
        funnel: [
          { week_start: '2026-11-16', type: 'plan_confirmed', households: 2 },
          { week_start: '2026-11-16', type: 'shopping_completed', households: 1 },
        ],
        swaps: { '2026-11-16': 3 },
        edits: { '2026-11-16': 1 },
        ratings: { count: 4, avg: 4.25, by_star: { '4': 3, '5': 1 } },
        counts: { swap: 5, plan_confirmed: 3 },
      },
    },
  },
  database: {
    ok: true,
    data: {
      stats: [
        { table: 'ai_usage', rows: 1234, dead_rows: 10, dead_ratio: 0.008, size_bytes: 524288 },
        { table: 'meal_plans', rows: 5000, dead_rows: 3000, dead_ratio: 0.375, size_bytes: 65536 },
        { table: 'shopping_lists', rows: 2, dead_rows: 1, dead_ratio: 0.33, size_bytes: 65536 },
      ],
      schema: [
        { migration: '019', name: 'app_errors', applied: true },
        { migration: '021', name: 'health_checks', applied: false },
      ],
    },
  },
  ...over,
});

describe('AdminDashboard (#249)', () => {
  // A wide desktop by default (every media query matches): the side navigation and the table columns. Tests for a phone or the in-between width stub their own.
  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders every section, in order', () => {
    render(<AdminDashboard links={LINKS} data={fixture()} />);
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['2 things need attention', 'Status', 'Errors', 'AI agent', 'Cost and quotas', 'Households', 'Weekly cycle and usage', 'Database', 'Tools']);
  });

  it('headline: says how many things need attention, with four tiles that link to their sections', () => {
    render(<AdminDashboard links={LINKS} data={fixture()} />);
    const section = screen.getByRole('region', { name: '2 things need attention' });
    expect(within(section).getByText(/The latest health check is failing: gemini/)).toBeInTheDocument();
    // Collapsed inbox rows are hidden from assistive tech, so only the tiles' links are in the accessible tree.
    expect(within(section).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['#status', '#errors', '#cost', '#households']);
    // Open, a row's action links lead to the section and to the tool that fixes it.
    for (const row of within(section).getAllByRole('listitem')) fireEvent.click(within(row).getByRole('button'));
    expect(within(section).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['#status', LINKS.targets.vercelLogs, '#errors', LINKS.targets.supabaseSql, '#status', '#errors', '#cost', '#households']);
    expect(within(section).getByText('Failing')).toBeInTheDocument();
    expect(within(section).getByText('gemini failing')).toBeInTheDocument();
    expect(within(section).getByText('$1.00')).toBeInTheDocument();
    expect(within(section).getByText('of $5.00 daily cap')).toBeInTheDocument();
    expect(within(section).getByText('1 of 2')).toBeInTheDocument();
  });

  describe('triage inbox (#279)', () => {
    it('comes before the headline numbers, one row per item, errors first', () => {
      render(<AdminDashboard links={LINKS} data={fixture()} />);
      const section = screen.getByRole('region', { name: '2 things need attention' });
      const rows = within(section).getAllByRole('listitem');
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveTextContent('Health check failing');
      expect(rows[1]).toHaveTextContent('New error');
      // The inbox is above the tiles in the document.
      const inbox = within(section).getByText('Health check failing');
      expect(inbox.compareDocumentPosition(within(section).getByText(/Active households/)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('each row says how bad, what, where and since when', () => {
      render(<AdminDashboard links={LINKS} data={fixture()} />);
      const rows = within(screen.getByRole('region', { name: '2 things need attention' })).getAllByRole('listitem');
      expect(within(rows[0]).getByText('Error')).toBeInTheDocument();
      expect(rows[0]).toHaveTextContent('Status · gemini · since 1 h ago');
      expect(within(rows[1]).getByText('Warning')).toBeInTheDocument();
      expect(rows[1]).toHaveTextContent('Errors · /api/coles-search · since 2 h ago');
    });

    it('opens to numbered fix steps and action links, dropping an action whose target cannot be built', () => {
      render(<AdminDashboard links={adminLinks({})} data={fixture()} />);
      const rows = within(screen.getByRole('region', { name: '2 things need attention' })).getAllByRole('listitem');
      for (const row of rows) fireEvent.click(within(row).getByRole('button'));
      expect(within(rows[0]).getByText('How to fix')).toBeInTheDocument();
      expect(within(rows[0]).getByText('1. gemini: top up the prepaid credits.')).toBeInTheDocument();
      expect(within(rows[0]).getByText('2. Run the Uptime workflow again.')).toBeInTheDocument();
      const logs = within(rows[0]).getByRole('link', { name: /Open Vercel logs/ });
      expect(logs).toHaveAttribute('href', adminLinks({}).targets.vercelLogs);
      expect(logs).toHaveAttribute('target', '_blank');
      expect(within(rows[0]).getByRole('link', { name: /See the check detail/ })).not.toHaveAttribute('target');
      // No Supabase URL in this env: the SQL editor action is left out rather than linking nowhere.
      expect(within(rows[1]).queryByRole('link', { name: /SQL editor/ })).toBeNull();
      expect(within(rows[1]).getByRole('link', { name: /See the new errors/ })).toHaveAttribute('href', '#errors');
    });

    it('puts no block element inside a paragraph in the inbox or the error rows', () => {
      render(<AdminDashboard links={LINKS} data={fixture()} />);
      const blocks = 'address, article, aside, blockquote, dd, details, div, dl, dt, fieldset, figure, footer, form, h1, h2, h3, h4, h5, h6, header, hr, li, main, menu, nav, ol, p, pre, section, table, ul';
      const offenders = ['2 things need attention', 'Errors'].flatMap((name) => {
        const region = screen.getByRole('region', { name });
        for (const toggle of region.querySelectorAll('[aria-expanded="false"]')) fireEvent.click(toggle);
        return Array.from(region.querySelectorAll('p')).flatMap((p) => Array.from(p.querySelectorAll(blocks)).map((el) => `<${el.tagName.toLowerCase()}> inside <p>: ${p.textContent?.slice(0, 60)}`));
      });
      expect(offenders).toEqual([]);
    });
  });

  it('one severity vocabulary: tiles, households and the database use the same StatusLabel, not a border colour or an emphasised Tag', () => {
    render(<AdminDashboard links={LINKS} data={fixture()} />);
    // Tiles: Failing status is an Error, 17% of the cap is OK; the neutral households tile has no label.
    const tiles = screen.getByRole('region', { name: '2 things need attention' });
    expect(within(tiles).getAllByRole('status').map((s) => s.getAttribute('aria-label'))).toEqual(expect.arrayContaining(['Status: Error', 'Status: Warning', 'Status: OK']));
    // A household's error count and a table's dead tuples are Warnings, as StatusLabels.
    const households = screen.getByRole('region', { name: 'Households' });
    expect(within(households).getByText('1 error').closest('[role="status"]')).toHaveAttribute('aria-label', 'Status: 1 error');
    expect(within(screen.getByRole('region', { name: 'Database' })).getByText('High dead tuples').closest('[role="status"]')).not.toBeNull();
  });

  it('headline: "All systems OK" when nothing needs attention', () => {
    render(<AdminDashboard links={LINKS} data={fixture({ attention: { ok: true, data: [] } })} />);
    expect(screen.getByRole('region', { name: 'All systems OK' })).toBeInTheDocument();
  });

  it('headline: says so when the attention rules could not run', () => {
    render(<AdminDashboard links={LINKS} data={fixture({ attention: { ok: false, hint: 'is migration 022 applied?' } })} />);
    expect(screen.getByRole('region', { name: "Couldn't work out what needs attention" })).toBeInTheDocument();
  });

  it('errors: says older kinds are not listed only when the list hits the query cap', () => {
    const base = fixture();
    if (!base.errors.ok) throw new Error('fixture errors failed');
    const one = base.errors.data[0];
    const many = Array.from({ length: ERROR_GROUP_LIMIT }, (_, i) => ({ ...one, fingerprint: `f${i}` }));
    render(<AdminDashboard links={LINKS} data={fixture({ errors: { ok: true, data: many } })} />);
    expect(screen.getByText(new RegExp(`Showing the ${ERROR_GROUP_LIMIT} most recently seen kinds of error`))).toBeTruthy();
    cleanup();
    render(<AdminDashboard links={LINKS} data={fixture({ errors: { ok: true, data: many.slice(1) } })} />);
    expect(screen.queryByText(/most recently seen kinds of error/)).toBeNull();
  });

  it('status: dependency states, uptime, missed checks, both releases and the last incident', () => {
    render(<AdminDashboard links={LINKS} data={fixture()} />);
    const section = screen.getByRole('region', { name: 'Status' });
    expect(within(section).getByText('50.00%')).toBeInTheDocument();
    expect(within(section).getByText('of 4 slots had no check recorded')).toBeInTheDocument();
    expect(within(section).getByText('def5678')).toBeInTheDocument();
    expect(within(section).getByText('The latest check ran on abc1234')).toBeInTheDocument();
    expect(within(section).getByText('45 min')).toBeInTheDocument(); // the incident: 3 slots
    expect(within(section).getByText(/billing_errors_last_hour/)).toBeInTheDocument();
    expect(within(section).getByText(/gemini failing/)).toBeInTheDocument();
    expect(within(section).getByText(/Possible outages/)).toBeInTheDocument();
    expect(within(section).getByRole('img', { name: /1 ok, 1 failing, 2 no data, in 4 slots/ })).toBeInTheDocument();
    expect(within(section).queryByText(/Monitoring began/)).not.toBeInTheDocument();
  });

  it('status: says when monitoring began partway through the range, and that uptime covers only that time', () => {
    const data = fixture();
    if (!data.status.ok) throw new Error('fixture');
    data.status.data.uptime.monitoringSince = t0;
    render(<AdminDashboard links={LINKS} data={data} />);
    expect(within(screen.getByRole('region', { name: 'Status' })).getByText(/Monitoring began .*so the uptime below covers that time rather than the whole range/)).toBeInTheDocument();
  });

  it('status: does not claim "All 0 checks passed" when the row has no individual results', () => {
    const data = fixture();
    if (!data.status.ok || !data.status.data.latest) throw new Error('fixture');
    data.status.data.latest.checks = {};
    render(<AdminDashboard links={LINKS} data={data} />);
    const section = screen.getByRole('region', { name: 'Status' });
    expect(within(section).getByText(/The check recorded no individual results/)).toBeInTheDocument();
    expect(within(section).queryByText(/All 0 checks/)).not.toBeInTheDocument();
  });

  it('status: with no health check recorded yet, there is no uptime strip to misread', () => {
    const data = fixture();
    if (!data.status.ok) throw new Error('fixture');
    data.status.data.latest = null;
    render(<AdminDashboard links={LINKS} data={data} />);
    const section = screen.getByRole('region', { name: 'Status' });
    expect(within(section).getByText(/No health check has been recorded yet/)).toBeInTheDocument();
    expect(within(section).queryByText('Uptime')).not.toBeInTheDocument();
  });

  it('uptime strip: neighbouring slots in one state are one cell, sized by the run', () => {
    const data = fixture();
    if (!data.status.ok) throw new Error('fixture');
    const slots = Array.from({ length: 600 }, (_, i) => ({ start: t0 + i * SLOT, state: i < 300 ? ('ok' as const) : i < 302 ? ('failing' as const) : ('ok' as const) }));
    data.status.data.uptime.slots = slots;
    render(<AdminDashboard links={LINKS} data={data} />);
    const strip = screen.getByRole('img', { name: /598 ok, 2 failing, 0 no data, in 600 slots/ });
    // Each run sits in a tooltip's wrapper: the cell is its first child.
    expect(strip.children).toHaveLength(3);
    expect(Array.from(strip.children).map((run) => (run.firstElementChild as HTMLElement).style.flex)).toEqual(['300 1 0px', '2 1 0px', '298 1 0px']);
  });

  it('uptime strip: where it starts and ends, the uptime beside it, a tooltip per run and an inline key', () => {
    render(<AdminDashboard links={LINKS} data={fixture()} />);
    const section = screen.getByRole('region', { name: 'Status' });
    const strip = within(section).getByRole('img', { name: /Uptime: 1 ok/ });
    // Start and end labels under the strip (the first slot is three hours before the page loaded).
    expect(within(section).getByText('3 h ago')).toBeInTheDocument();
    expect(within(section).getByText('Now')).toBeInTheDocument();
    // Each run's state and time range, as the tooltip's description (merged: the two no-data slots are one 30 minute run).
    expect(strip.children).toHaveLength(3);
    expect(within(section).getByText('Healthy: 2026-11-18 09:00 UTC to 2026-11-18 09:15 UTC (15 min)')).toBeInTheDocument();
    expect(within(section).getByText('Check failing: 2026-11-18 09:15 UTC to 2026-11-18 09:30 UTC (15 min)')).toBeInTheDocument();
    expect(within(section).getByText('No check recorded: 2026-11-18 09:30 UTC to 2026-11-18 10:00 UTC (30 min)')).toBeInTheDocument();
    // The runs are not tab stops: there'd be hundreds, and the outages are listed in text.
    expect(strip.querySelectorAll('[tabindex]')).toHaveLength(0);
    // The key names each state, in words, beside a swatch.
    expect(within(section).getByText('Healthy')).toBeInTheDocument();
    expect(within(section).getByText('Check failing')).toBeInTheDocument();
    expect(within(section).getByText(/No check recorded \(usually GitHub skipping a run/)).toBeInTheDocument();
    expect(within(section).queryByText(/Each cell is 15 minutes/)).toBeNull();
    // Uptime % is beside the strip, in the same row of the grid.
    const tracker = within(section).getByTestId('uptime-tracker');
    expect(within(tracker).getByRole('img', { name: /Uptime: 1 ok/ })).toBe(strip);
    expect(within(tracker).getByText('50.00%')).toBeInTheDocument();
  });

  it('errors: a group per fingerprint with its detail', () => {
    render(<AdminDashboard links={LINKS} data={fixture()} />);
    const section = screen.getByRole('region', { name: 'Errors' });
    expect(within(section).getByText('coles-search: lookup failed', { selector: 'strong' })).toBeInTheDocument();
    expect(within(section).queryByText(/release abc1234 · route · status 429/)).toBeNull(); // not rendered until the row is opened
    fireEvent.click(within(section).getByRole('button', { name: /coles-search: lookup failed/ }));
    expect(within(section).getByText(/release abc1234 · route · status 429/)).toBeInTheDocument();
    // Collapsed row: where, how often, how many households, when.
    expect(within(section).getByText('/api/coles-search · 4× · 2 households · last 37 min ago')).toBeInTheDocument();
  });

  it('errors: a Sentry-style row with severity and state, then label/value details and investigate links', () => {
    render(<AdminDashboard links={LINKS} data={fixture()} />);
    const row = within(screen.getByRole('region', { name: 'Errors' })).getAllByRole('listitem')[0];
    fireEvent.click(within(row).getAllByRole('button')[0]);
    // A server-side error that hit two households, first seen 2 hours ago.
    expect(within(row).getByText('Error')).toBeInTheDocument();
    expect(within(row).getByText('New')).toBeInTheDocument();
    for (const [label, value] of [
      ['Route', '/api/coles-search'],
      ['Source', 'route'],
      ['Households affected', '2'],
      ['Events', '4 in 24 h, 4 in 7 d'],
      ['Releases', 'abc1234'],
    ]) {
      expect(within(row).getByText(label).nextElementSibling).toHaveTextContent(value);
    }
    expect(within(row).getByText('First seen').nextElementSibling).toHaveTextContent('2 h ago (2026-11-18 10:00 UTC)');
    expect(within(row).getByText('Recent occurrences')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: /Open Vercel runtime logs/ })).toHaveAttribute('href', `${LINKS.targets.vercelLogs}?search=${encodeURIComponent('/api/coles-search')}`);
    expect(within(row).getByRole('link', { name: /Search the code on GitHub/ })).toHaveAttribute('href', `${LINKS.targets.githubRepo}/search?q=${encodeURIComponent('"coles-search: lookup failed"')}&type=code`);
  });

  it('errors: the most severe come first, and one not seen in 24 hours reads Quiet', () => {
    const base = fixture();
    if (!base.errors.ok) throw new Error('fixture');
    const [one] = base.errors.data;
    const quiet = { ...one, fingerprint: 'quiet', label: 'old quiet error', count_24h: 0, first_seen: '2026-11-01T00:00:00Z', last_seen: '2026-11-17T00:00:00Z' };
    render(<AdminDashboard links={LINKS} data={fixture({ errors: { ok: true, data: [quiet, one] } })} />);
    const rows = within(screen.getByRole('region', { name: 'Errors' })).getAllByRole('listitem').filter((li) => li.getAttribute('role') !== 'none' && li.querySelector('strong'));
    expect(rows.map((li) => li.querySelector('strong')?.textContent)).toEqual(['coles-search: lookup failed', 'old quiet error']);
    expect(within(rows[1]).getByText('Quiet')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Ongoing')).toBeInTheDocument();
  });

  it('AI agent, cost and quotas', () => {
    render(<AdminDashboard links={LINKS} data={fixture()} />);
    const ai = screen.getByRole('region', { name: 'AI agent' });
    // Real columns: a header row of labels over one row of cells per task.
    const table = within(ai).getByRole('table', { name: 'AI calls by task' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Task', 'Model', 'Calls', 'Success', 'p50', 'p95', 'Tokens in', 'Tokens out', 'Cost']);
    const row = within(table).getAllByRole('row')[1];
    const cells = within(row).getAllByRole('cell');
    expect(cells.slice(0, 9).map((c) => c.textContent)).toEqual(['generation', 'gemini-x', '20', '90%', '4.0 s', '9.0 s', '1,200', '800', '$0.400']);
    // What went wrong is a cell of the row too, so assistive tech reads it with the row.
    expect(cells).toHaveLength(10);
    expect(cells[9]).toHaveTextContent('error 2, http_503 ×2');
    // Calls per day: the day label sits in the same row as its bar.
    const day = within(ai).getByTestId('bar-row-2026-11-18');
    expect(within(day).getByText('2026-11-18')).toBeInTheDocument();
    expect(within(day).getByRole('progressbar', { name: '2026-11-18: 20 calls, 18 ok' })).toBeInTheDocument();
    expect(within(day).getByText('20 calls, 18 ok, $0.400')).toBeInTheDocument();
    const cost = screen.getByRole('region', { name: 'Cost and quotas' });
    expect(within(cost).getByText('$1.00 of $5.00')).toBeInTheDocument();
    expect(within(cost).getByText('$17.00')).toBeInTheDocument();
    expect(within(cost).getByText('850 of 1000')).toBeInTheDocument();
  });

  it('cost and quotas: two meters with the same anatomy, and the setting that raises each limit as visible text', () => {
    render(<AdminDashboard links={LINKS} data={fixture()} />);
    const cost = screen.getByRole('region', { name: 'Cost and quotas' });
    const meters = [
      { label: 'AI spend today (UTC)', value: '$1.00 of $5.00', status: 'Status: OK', note: '20% of the daily cap, which resets at midnight UTC', env: 'AI_DAILY_SPEND_CAP_USD' },
      { label: 'Coles lookups, 2026-11', value: '850 of 1000', status: 'Status: Near the limit', note: '150 remaining this month', env: 'COLES_API_MONTHLY_LIMIT' },
    ];
    for (const meter of meters) {
      const card = within(cost).getByTestId(`meter-${meter.label}`);
      expect(within(card).getByText(meter.label)).toBeInTheDocument();
      expect(within(card).getByText(meter.value)).toBeInTheDocument();
      expect(within(card).getByRole('status')).toHaveAttribute('aria-label', meter.status);
      expect(within(card).getByRole('progressbar', { name: `${meter.label}: ${meter.value}` })).toBeInTheDocument();
      expect(within(card).getByText(meter.note)).toBeInTheDocument();
      expect(within(card).getByText(`Raise the limit with ${meter.env} in Vercel.`)).toBeInTheDocument();
    }
  });

  it('cost and quotas: at the cap the meter is an error', () => {
    const data = fixture();
    if (!data.cost.ok) throw new Error('fixture');
    data.cost.data.spendTodayUsd = 5;
    render(<AdminDashboard links={LINKS} data={data} />);
    expect(within(screen.getByRole('region', { name: 'Cost and quotas' })).getByText('At the limit').closest('[role="status"]')).toHaveAttribute('aria-label', 'Status: At the limit');
  });

  it('cost and quotas: with no Coles quota row the AI meter still shows, and the other says why', () => {
    const data = fixture();
    if (!data.cost.ok) throw new Error('fixture');
    data.cost.data.coles = null;
    render(<AdminDashboard links={LINKS} data={data} />);
    const cost = screen.getByRole('region', { name: 'Cost and quotas' });
    expect(within(cost).getByText('$1.00 of $5.00')).toBeInTheDocument();
    expect(within(cost).getByText("Couldn't load (is migration 018 applied?)")).toBeInTheDocument();
  });

  it('AI agent: a phone gets label/value pairs instead of a header row', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }));
    render(<AdminDashboard links={LINKS} data={fixture()} />);
    const table = within(screen.getByRole('region', { name: 'AI agent' })).getByRole('table', { name: 'AI calls by task' });
    expect(within(table).queryAllByRole('columnheader')).toHaveLength(0);
    const cells = within(within(table).getAllByRole('row')[0]).getAllByRole('cell');
    expect(cells[0].textContent).toBe('generation'); // the row's name, unlabelled
    expect(cells[2].textContent).toBe('Calls20');
    expect(cells[4].textContent).toBe('p504.0 s');
    vi.unstubAllGlobals();
  });

  it('columns only where there is room: not beside the side navigation, between the large and extra-large breakpoints', () => {
    const queries: string[] = [];
    vi.stubGlobal('matchMedia', (query: string) => {
      queries.push(query);
      return { matches: true, addEventListener: () => {}, removeEventListener: () => {} };
    });
    render(<AdminDashboard links={LINKS} data={fixture()} />);
    expect(queries).toContain('(min-width: 768px) and (max-width: 1023.98px), (min-width: 1280px)');
  });

  it('beside the side navigation (large, below extra-large) rows are label/value pairs, not squeezed columns', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(min-width: 1024px)', addEventListener: () => {}, removeEventListener: () => {} }));
    render(<AdminDashboard links={LINKS} data={fixture()} />);
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeInTheDocument();
    expect(screen.queryAllByRole('columnheader')).toHaveLength(0);
    expect(within(screen.getByRole('table', { name: 'Households' })).getAllByRole('cell')[2]).toHaveTextContent('Last active');
  });

  it('AI agent: says what went wrong under a task that has failures, and nothing under one that has none', () => {
    const data = fixture();
    if (!data.ai.ok) throw new Error('fixture');
    data.ai.data.by_task.push({ task: 'extract', model: 'gemini-y', calls: 3, ok_calls: 3, p50_ms: 850, p95_ms: 1200, avg_input_tokens: null, avg_output_tokens: null, cost_usd: 0, statuses: { ok: 3 }, top_errors: [] });
    render(<AdminDashboard links={LINKS} data={data} />);
    const table = within(screen.getByRole('region', { name: 'AI agent' })).getByRole('table', { name: 'AI calls by task' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent('error 2, http_503 ×2');
    expect(rows[2]).not.toHaveTextContent('http_503');
    expect(within(rows[2]).getAllByRole('cell')).toHaveLength(9);
    expect(within(rows[2]).getAllByRole('cell').map((c) => c.textContent)).toEqual(['extract', 'gemini-y', '3', '100%', '850 ms', '1.2 s', '–', '–', '$0.00']);
  });

  it('households: short IDs only, in columns, each with an explicit Filter action', () => {
    render(<AdminDashboard links={LINKS} data={fixture()} />);
    const section = screen.getByRole('region', { name: 'Households' });
    const table = within(section).getByRole('table', { name: 'Households' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Household', 'Members', 'Last active', 'Plan this week', 'Settings done', 'AI calls / cost', 'Errors', 'Page filter']);
    const first = within(within(table).getAllByRole('row')[1]).getAllByRole('cell');
    expect(first.map((c) => c.textContent)).toEqual(['abcdef12You', '2+1 invited', '1 h ago', 'Yes', 'Yes', '12$0.200', '1 errorpending status', 'Filter']);
    const second = within(within(table).getAllByRole('row')[2]).getAllByRole('cell');
    expect(second.map((c) => c.textContent)).toEqual(['12345678', '1', 'never', 'No', 'No', '0$0.00', '0', 'Filter']);
    const link = within(section).getByRole('link', { name: 'Filter the page to household abcdef12' });
    expect(link).toHaveAttribute('href', '/admin?range=7d&household=abcdef12#households');
    expect(link).toHaveTextContent('Filter');
  });

  it('households: the filtered one is shaded and its action clears the filter', () => {
    render(<AdminDashboard links={LINKS} data={fixture({ household: 'abcdef12' })} />);
    const section = screen.getByRole('region', { name: 'Households' });
    const clear = within(section).getByRole('link', { name: 'Clear the filter on household abcdef12' });
    expect(clear).toHaveAttribute('href', '/admin?range=7d#households');
    expect(clear).toHaveTextContent('Clear');
    expect(within(section).getByRole('link', { name: 'Filter the page to household 12345678' })).toHaveAttribute('href', '/admin?range=7d&household=12345678#households');
  });

  it('households: your own is marked You, and the rest are not', () => {
    render(<AdminDashboard links={LINKS} data={fixture()} />);
    const section = screen.getByRole('region', { name: 'Households' });
    expect(within(section).getAllByText('You')).toHaveLength(1);
    expect(within(section).getByText('You').closest('[role="row"]')).toHaveTextContent('abcdef12');
  });

  describe('layout (#282)', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
      window.location.hash = '';
    });
    const phone = () => vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }));

    it('side navigation: one anchor link per area, with the number of inbox items in each', () => {
      render(<AdminDashboard links={LINKS} data={fixture()} />);
      const nav = screen.getByRole('navigation', { name: 'Sections' });
      const links = within(nav).getAllByRole('link');
      expect(links.map((a) => a.getAttribute('href'))).toEqual(['#overview', '#status', '#errors', '#ai', '#cost', '#households', '#cycle', '#database', '#tools']);
      const named = Object.fromEntries(links.map((a) => [a.getAttribute('href'), a.getAttribute('aria-label') ?? a.textContent]));
      expect(named['#overview']).not.toMatch(/need attention/); // the inbox itself: the badges below add up to it
      expect(named['#status']).toMatch(/Status.*1 need attention/);
      expect(named['#errors']).toMatch(/Errors.*1 need attention/);
      expect(named['#ai']).not.toMatch(/need attention/);
      expect(named['#database']).not.toMatch(/need attention/);
    });

    it('side navigation: no badges when the attention rules could not run', () => {
      render(<AdminDashboard links={LINKS} data={fixture({ attention: { ok: false, hint: 'is migration 022 applied?' } })} />);
      expect(within(screen.getByRole('navigation', { name: 'Sections' })).queryByText(/need attention/)).toBeNull();
    });

    it('on a phone the navigation is in a Sheet behind a Sections button, and choosing an item closes it', () => {
      phone();
      render(<AdminDashboard links={LINKS} data={fixture()} />);
      expect(screen.queryByRole('navigation', { name: 'Sections' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Sections' }));
      const nav = screen.getByRole('navigation', { name: 'Sections' });
      expect(within(nav).getAllByRole('link')).toHaveLength(9);
      fireEvent.click(within(nav).getAllByRole('link')[2]);
      expect(screen.queryByRole('navigation', { name: 'Sections' })).toBeNull();
    });

    it('on a desktop there is no Sections button', () => {
      render(<AdminDashboard links={LINKS} data={fixture()} />);
      expect(screen.queryByRole('button', { name: 'Sections' })).toBeNull();
    });

    it('every section is on a surface with its title, a one-line note and the rest behind an info button', () => {
      render(<AdminDashboard links={LINKS} data={fixture()} />);
      const notes: Record<string, string> = {
        Status: 'Is the app up? Checked every 15 minutes.',
        Errors: 'Grouped so repeats count once. Open a row for the details.',
        'AI agent': 'Per task over the range. p50 is the typical call, p95 the slowest 5%.',
        'Cost and quotas': 'AI spend against the daily cap, Coles lookups against the monthly limit.',
        Households: 'Most recently active first. Use Filter to focus the page on one.',
        'Weekly cycle and usage': 'How far households get through the weekly routine.',
        Database: 'Whether every migration has run, and how big the tables are.',
      };
      for (const [name, note] of Object.entries(notes)) {
        const section = screen.getByRole('region', { name });
        expect(within(section).getByRole('button', { name: `About ${name}` })).toBeInTheDocument();
        expect(within(section).getByText(note)).toBeInTheDocument();
        expect(note.length).toBeLessThan(80); // one line
      }
      // The long explanation is the tooltip's description, not a paragraph in the section.
      expect(within(screen.getByRole('region', { name: 'Households' })).getByRole('button', { name: 'About Households' })).toHaveAccessibleDescription(/IDs are short on purpose/);
    });

    it('section header actions link to the tool for that section, in a new tab', () => {
      render(<AdminDashboard links={LINKS} data={fixture()} />);
      const status = within(screen.getByRole('region', { name: 'Status' })).getByRole('link', { name: 'Uptime workflow' });
      expect(status).toHaveAttribute('href', LINKS.targets.uptimeWorkflow);
      expect(status).toHaveAttribute('target', '_blank');
      expect(within(screen.getByRole('region', { name: 'Errors' })).getByRole('link', { name: 'Runtime logs' })).toHaveAttribute('href', LINKS.targets.vercelLogs);
    });

    it('the whole page runs at compact density', () => {
      const { container } = render(<AdminDashboard links={LINKS} data={fixture()} />);
      const region = container.querySelector('[data-co-density="compact"]');
      expect(region).not.toBeNull();
      for (const id of ['overview', 'status', 'errors', 'ai', 'cost', 'households', 'cycle', 'database', 'tools']) expect(region?.querySelector(`#${id}`), id).not.toBeNull();
    });

    it('KPI cards state their time frame, and the whole card is clickable', () => {
      render(<AdminDashboard links={LINKS} data={fixture()} />);
      const section = screen.getByRole('region', { name: '2 things need attention' });
      for (const label of ['Status · latest check', 'Errors · 7 days', 'AI spend · today', 'Active households · 7 days']) expect(within(section).getByText(label)).toBeInTheDocument();
      // Clicking anywhere on the card (here its value) goes to the section.
      fireEvent.click(within(section).getByText('of $5.00 daily cap'));
      expect(window.location.hash).toBe('#cost');
    });

    it('a second click on the same card still scrolls to its section', () => {
      const scrolled: string[] = [];
      const scrollIntoView = vi.fn(function (this: HTMLElement) {
        scrolled.push(this.id);
      });
      Element.prototype.scrollIntoView = scrollIntoView;
      render(<AdminDashboard links={LINKS} data={fixture()} />);
      const section = screen.getByRole('region', { name: '2 things need attention' });
      fireEvent.click(within(section).getByText('of $5.00 daily cap'));
      fireEvent.click(within(section).getByText('of $5.00 daily cap'));
      expect(scrolled).toEqual(['cost', 'cost']);
    });

    it('a click on a card\'s own label link is left to the link, not handled twice', () => {
      const push = vi.spyOn(window.history, 'pushState');
      render(<AdminDashboard links={LINKS} data={fixture()} />);
      const section = screen.getByRole('region', { name: '2 things need attention' });
      fireEvent.click(within(section).getByRole('link', { name: 'AI spend · today' }));
      expect(push).not.toHaveBeenCalled();
    });

    it('marks the area in view in the navigation, and keeps it between sections', () => {
      let report: (entries: { target: { id: string }; isIntersecting: boolean }[]) => void = () => {};
      vi.stubGlobal(
        'IntersectionObserver',
        class {
          constructor(callback: typeof report, options?: { rootMargin?: string }) {
            if (options?.rootMargin === '-10% 0px -60% 0px') report = callback; // ours, not next/link's prefetch observers
          }
          observe() {}
          unobserve() {}
          disconnect() {}
        }
      );
      render(<AdminDashboard links={LINKS} data={fixture()} />);
      const nav = screen.getByRole('navigation', { name: 'Sections' });
      expect(within(nav).queryByRole('link', { current: 'page' })).toBeNull();
      act(() => report([{ target: { id: 'errors' }, isIntersecting: true }]));
      expect(within(nav).getByRole('link', { current: 'page' })).toHaveAttribute('href', '#errors');
      // Two in the band at once: the one higher up the page wins. None in it: the last one stays.
      act(() => report([{ target: { id: 'status' }, isIntersecting: true }]));
      expect(within(nav).getByRole('link', { current: 'page' })).toHaveAttribute('href', '#status');
      act(() => report([{ target: { id: 'status' }, isIntersecting: false }, { target: { id: 'errors' }, isIntersecting: false }]));
      expect(within(nav).getByRole('link', { current: 'page' })).toHaveAttribute('href', '#status');
    });

    it('at the end of the page marks the last section, which can never reach the band', () => {
      vi.stubGlobal(
        'IntersectionObserver',
        class {
          observe() {}
          unobserve() {}
          disconnect() {}
        }
      );
      const height = vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(3000);
      render(<AdminDashboard links={LINKS} data={fixture()} />);
      const nav = screen.getByRole('navigation', { name: 'Sections' });
      window.scrollY = 3000 - window.innerHeight;
      act(() => {
        window.dispatchEvent(new Event('scroll'));
      });
      expect(within(nav).getByRole('link', { current: 'page' })).toHaveAttribute('href', '#tools');
      height.mockRestore();
      window.scrollY = 0;
    });

    it('a Sheet left open does not come back when the window narrows again', () => {
      let wide = false;
      const listeners = new Set<() => void>();
      vi.stubGlobal('matchMedia', () => ({
        get matches() {
          return wide;
        },
        addEventListener: (_: string, fn: () => void) => listeners.add(fn),
        removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
      }));
      render(<AdminDashboard links={LINKS} data={fixture()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Sections' }));
      expect(screen.getByRole('navigation', { name: 'Sections' })).toBeInTheDocument();
      wide = true;
      act(() => listeners.forEach((fn) => fn()));
      wide = false;
      act(() => listeners.forEach((fn) => fn()));
      fireEvent.click(screen.getByRole('button', { name: 'Sections' }));
      // Opened once by the click above, not twice: one navigation, and it closes in one go.
      fireEvent.click(within(screen.getByRole('navigation', { name: 'Sections' })).getAllByRole('link')[0]);
      expect(screen.queryByRole('navigation', { name: 'Sections' })).toBeNull();
    });
  });

  describe('page header (#282)', () => {
    const header = () => screen.getByRole('heading', { level: 1, name: 'Admin' }).closest('div')?.parentElement?.parentElement as HTMLElement;
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
      vi.setSystemTime(new Date(NOW));
    });
    afterEach(() => vi.useRealTimers());

    it('"Updated" reads the true age at once when the data is old (a cached page), and keeps counting', () => {
      vi.setSystemTime(new Date(new Date(NOW).getTime() + 3 * 3_600_000));
      render(<AdminDashboard links={LINKS} data={fixture()} />);
      expect(within(header()).getByText('Updated 3 h ago')).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(60 * 60_000);
      });
      expect(within(header()).getByText('Updated 4 h ago')).toBeInTheDocument();
    });

    it('has the title, when the data was loaded with the exact time on hover, Refresh and the time range', () => {
      render(<AdminDashboard links={LINKS} data={fixture()} />);
      const bar = header();
      expect(within(bar).getByText('Updated just now')).toBeInTheDocument();
      expect(within(bar).getByText('Loaded 2026-11-18 12:07 UTC')).toBeInTheDocument(); // the tooltip's description
      expect(within(bar).getByRole('button', { name: /Refresh/ })).toBeEnabled();
      expect(within(bar).getByText('Time range')).toBeInTheDocument();
      expect(within(bar).getByRole('button', { name: /Time range/ })).toBeInTheDocument();
    });

    it('has no jump-link row and no range tabs: navigation is the side nav, the range is a filter', () => {
      render(<AdminDashboard links={LINKS} data={fixture()} />);
      expect(screen.queryByRole('navigation', { name: 'Jump to a section' })).toBeNull();
      expect(screen.queryByRole('tab')).toBeNull();
    });

    it('Refresh re-reads the page without navigating', () => {
      refresh.mockClear();
      push.mockClear();
      render(<AdminDashboard links={LINKS} data={fixture()} />);
      fireEvent.click(screen.getByRole('button', { name: /Refresh/ }));
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(push).not.toHaveBeenCalled();
    });

    it('choosing a range navigates, keeping the household', () => {
      push.mockClear();
      render(<AdminDashboard links={LINKS} data={fixture({ household: 'abcdef12' })} />);
      fireEvent.click(within(header()).getByRole('button', { name: /Time range/ }));
      fireEvent.click(screen.getByRole('option', { name: 'Last 30 days' }));
      expect(push).toHaveBeenCalledWith('/admin?range=30d&household=abcdef12');
    });

    it('a selected household is a removable chip, and removing it keeps the range', () => {
      push.mockClear();
      render(<AdminDashboard links={LINKS} data={fixture({ household: 'abcdef12' })} />);
      expect(screen.getByText('Household abcdef12')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'clear filter' })).toBeNull();
      fireEvent.click(within(screen.getByRole('status', { name: /Household abcdef12/ })).getByRole('button'));
      expect(push).toHaveBeenCalledWith('/admin?range=7d');
    });

    it('shows no chip without a household filter', () => {
      render(<AdminDashboard links={LINKS} data={fixture()} />);
      expect(screen.queryByText(/^Household [0-9a-f]{8}$/)).toBeNull();
    });
  });

  it('weekly cycle: counts under 10 plans, percentages at 10 or more, and the pillar indicators', () => {
    render(<AdminDashboard links={LINKS} data={fixture()} />);
    const section = screen.getByRole('region', { name: 'Weekly cycle and usage' });
    const week = within(section).getByText('Week of 16 Nov').closest('li');
    expect(week).toHaveTextContent('2 composed · 2 confirmed'); // a count, not "100%"
    expect(week).not.toHaveTextContent('%');
    expect(within(section).getByText('1.3')).toBeInTheDocument(); // (3 swaps + 1 edit) / 3 plans
    expect(within(section).getByText('9')).toBeInTheDocument(); // recipes added
    expect(within(section).getByText(/7 by AI, 1 imported, 1 by hand/)).toBeInTheDocument();
    expect(within(section).getByText('3.5')).toBeInTheDocument();
    // The newest week as ranked bars: composed, then each step with its count.
    const bar = (name: string) => within(section).getByRole('progressbar', { name });
    expect(bar('Composed: 2 of 2')).toHaveAttribute('aria-valuenow', '100');
    expect(bar('Confirmed: 2 of 2')).toHaveAttribute('aria-valuenow', '100');
    expect(bar('List built: 0 of 2')).toHaveAttribute('aria-valuenow', '0');
    expect(bar('Sent to Coles: 0 of 2')).toHaveAttribute('aria-valuenow', '0');
    expect(bar('Done: 1 of 2')).toHaveAttribute('aria-valuenow', '50');
    expect(within(section).getByText('Week of 16 Nov, households at each step')).toBeInTheDocument();
    expect(within(section).getByTestId('bar-row-Done')).toHaveTextContent('1'); // a count, not "50%": under 10 plans
    expect(within(section).getByText('swap 5')).toBeInTheDocument();
  });

  it('weekly cycle: the funnel stops at composing when product events are not applied, and says so', () => {
    const data = fixture();
    if (!data.cycle.ok) throw new Error('fixture');
    data.cycle.data.events.available = false;
    render(<AdminDashboard links={LINKS} data={data} />);
    const section = screen.getByRole('region', { name: 'Weekly cycle and usage' });
    expect(within(section).getByRole('progressbar', { name: 'Composed: 2 of 2' })).toBeInTheDocument();
    expect(within(section).queryByRole('progressbar', { name: /^Confirmed/ })).toBeNull();
    expect(within(section).getByText("Migration 020 isn't applied, so every step after composing shows 0.")).toBeInTheDocument();
  });

  it('weekly cycle: shows percentages once there are 10 or more plans in a week', () => {
    const data = fixture();
    if (!data.cycle.ok) throw new Error('fixture');
    data.cycle.data.weeks[0].composed = 20;
    data.cycle.data.events.funnel = [{ week_start: '2026-11-16', type: 'plan_confirmed', households: 10 }];
    render(<AdminDashboard links={LINKS} data={data} />);
    expect(within(screen.getByRole('region', { name: 'Weekly cycle and usage' })).getByText(/20 composed · 10 \(50%\) confirmed/)).toBeInTheDocument();
  });

  it('database: a status list of migrations, and tables as columns that flag dead rows only where they matter', () => {
    render(<AdminDashboard links={LINKS} data={fixture()} />);
    const section = screen.getByRole('region', { name: 'Database' });
    expect(within(section).getByText('Migrations 019 to 021: 021 is missing.')).toBeInTheDocument();
    // Open by default when something is missing: every migration with its status.
    const migrations = within(section).getByText('019 · app_errors').closest('li') as HTMLElement;
    expect(within(migrations).getByText('Applied')).toBeInTheDocument();
    const missing = within(section).getByText('021 · health_checks').closest('li') as HTMLElement;
    expect(within(missing).getByText('Missing').closest('[role="status"]')).toHaveAttribute('aria-label', 'Status: Missing');
    const table = within(section).getByRole('table', { name: 'Database tables' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Table', 'Rows (est.)', 'Size', 'Dead rows', 'Flag']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getAllByRole('cell').map((c) => c.textContent))).toEqual([
      ['ai_usage', '1,234', '512 KB', '0.8%', '–'],
      ['meal_plans', '5,000', '64 KB', '37.5%', 'High dead tuplespending status'],
      ['shopping_lists', '2', '64 KB', '33.0%', '–'], // 33% dead but 2 rows: not flagged
    ]);
    expect(within(section).getByText('meal_plans has many dead rows and may need a vacuum.')).toBeInTheDocument();
    // The loose Supabase and Vercel links moved to Tools; only the header action stays.
    expect(within(section).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([LINKS.targets.supabaseSql]);
  });

  it('database: with every migration applied it says so in one line, and the list is closed', () => {
    const data = fixture();
    if (!data.database.ok) throw new Error('fixture');
    data.database.data.schema = [{ migration: '019', name: 'app_errors', applied: true }, { migration: '020', name: 'product_events', applied: true }];
    render(<AdminDashboard links={LINKS} data={data} />);
    const section = screen.getByRole('region', { name: 'Database' });
    expect(within(section).getByText('Migrations 019 to 020: all 2 applied.')).toBeInTheDocument();
    expect(within(section).queryByText('Missing')).not.toBeInTheDocument();
    expect(within(section).getByText('all 2 applied')).toBeInTheDocument();
  });

  it('tools: every Supabase, Vercel, GitHub and debug link in one section, external ones with an icon and a new tab', () => {
    render(<AdminDashboard links={LINKS} data={fixture()} />);
    const section = screen.getByRole('region', { name: 'Tools' });
    const links = within(section).getAllByRole('link');
    const hrefs = links.map((a) => a.getAttribute('href'));
    for (const link of [...LINKS.supabase, ...LINKS.vercel, ...LINKS.debug]) expect(hrefs).toContain(link.href);
    expect(hrefs).toContain(LINKS.targets.uptimeWorkflow);
    expect(hrefs).toContain(LINKS.targets.githubRepo);
    const external = within(section).getByRole('link', { name: 'Vercel project (opens in a new tab)' });
    expect(external).toHaveAttribute('target', '_blank');
    expect(external).toHaveAttribute('rel', 'noreferrer');
    expect(external.querySelector('svg')).not.toBeNull(); // the external-link icon
    const internal = within(section).getByRole('link', { name: 'API usage' });
    expect(internal).toHaveAttribute('href', '/debug/api-usage');
    expect(internal).not.toHaveAttribute('target');
    expect(internal.querySelector('svg')).toBeNull();
    // Nothing is left loose in the other sections.
    for (const name of ['Database', 'Status']) expect(within(screen.getByRole('region', { name })).queryByRole('link', { name: /Supabase|Vercel project/ })).toBeNull();
  });

  it('tools: without a hosted Supabase project there is no Supabase group', () => {
    const noSupabase = adminLinks({});
    render(<AdminDashboard links={noSupabase} data={fixture()} />);
    expect(within(screen.getByRole('region', { name: 'Tools' })).queryByText('Supabase')).toBeNull();
  });

  it('a section that could not load says so with its migration hint, and the rest still render', () => {
    render(
      <AdminDashboard
        links={LINKS}
        data={fixture({ errors: { ok: false, hint: 'is migration 019 or 022 applied?' }, cycle: { ok: false, hint: 'is migration 022 applied?' } })}
      />
    );
    expect(within(screen.getByRole('region', { name: 'Errors' })).getByText("Couldn't load (is migration 019 or 022 applied?)")).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Weekly cycle and usage' })).getByText("Couldn't load (is migration 022 applied?)")).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'AI agent' })).getAllByText('generation').length).toBeGreaterThan(0);
    expect(within(screen.getByRole('region', { name: 'Households' })).getByText('abcdef12')).toBeInTheDocument();
  });

  it('every section degrades alone: all failing still renders the page', () => {
    const failed = { ok: false as const, hint: 'is migration 022 applied?' };
    render(<AdminDashboard links={LINKS} data={fixture({ attention: failed, status: failed, errors: failed, ai: failed, cost: failed, households: failed, cycle: failed, database: failed })} />);
    expect(screen.getAllByText(/Couldn't load/)).toHaveLength(8);
  });

  it('shows no email address or name anywhere on the page', () => {
    const { container } = render(<AdminDashboard links={LINKS} data={fixture()} />);
    expect(container.textContent).not.toMatch(/@/);
  });

  // React's generated ids (`_r_3_`, for the tooltip's description) differ between two renders in one test.
  const stable = (html: string) => html.replace(/_r_[0-9a-z]+_/g, '_r_');

  describe('hydration (React #418)', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    });

    // ListItem renders `primary` inside a <p> (and `secondary` in a <span>). A Stack (a div)
    // in a <p> is invalid HTML: the browser closes the <p> early when it parses the server's
    // HTML, React finds a different tree on hydration and throws #418. jsdom builds the tree
    // as written and doesn't repair it, so check the markup. Expanded content is always in
    // the DOM (just hidden), so no clicking is needed to cover it.
    it('puts no block element inside a paragraph', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { container } = render(<AdminDashboard links={LINKS} data={fixture()} />);
      const blocks = 'address, article, aside, blockquote, dd, details, div, dl, dt, fieldset, figure, footer, form, h1, h2, h3, h4, h5, h6, header, hr, li, main, menu, nav, ol, p, pre, section, table, ul';
      const offenders = Array.from(container.querySelectorAll('p')).flatMap((p) => Array.from(p.querySelectorAll(blocks)).map((el) => `<${el.tagName.toLowerCase()}> inside <p>: ${p.textContent?.slice(0, 60)}`));
      expect(offenders).toEqual([]);
      const nesting = spy.mock.calls.filter((args) => /validateDOMNesting|cannot be a descendant|cannot contain/.test(String(args[0])));
      expect(nesting).toEqual([]);
    });

    // The page builds the links on the server and passes them in. In the browser
    // process.env has none of these values, so a section that read the env itself
    // would render different markup from the server's HTML and fail to hydrate.
    it('renders the same markup whatever the environment, because the links come in as a prop', () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abcd1234.supabase.co');
      vi.stubEnv('ADMIN_VERCEL_PROJECT_URL', 'https://vercel.com/team/app');
      const withEnv = stable(render(<AdminDashboard links={LINKS} data={fixture()} />).container.innerHTML);
      cleanup();

      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
      vi.stubEnv('ADMIN_VERCEL_PROJECT_URL', '');
      const withoutEnv = stable(render(<AdminDashboard links={LINKS} data={fixture()} />).container.innerHTML);

      expect(withoutEnv).toBe(withEnv);
      expect(withoutEnv).toContain('https://supabase.com/dashboard/project/abcd1234/sql/new');
    });
  });
});
