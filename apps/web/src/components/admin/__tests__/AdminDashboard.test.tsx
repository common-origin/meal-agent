import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import AdminDashboard from '../AdminDashboard';
import { adminLinks } from '@/lib/admin/links';
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
      { id: 'health-failing', severity: 'error', section: 'status', message: 'The latest health check is failing: gemini' },
      { id: 'new-errors', severity: 'warning', section: 'errors', message: '1 new error in the last 24 hours: coles-search: lookup failed' },
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
  it('renders every section, in order', () => {
    render(<AdminDashboard links={LINKS} data={fixture()} />);
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['2 things need attention', 'Status', 'Errors', 'AI agent', 'Cost and quotas', 'Households', 'Weekly cycle and usage', 'Database', 'Debug pages']);
  });

  it('headline: says how many things need attention, with four tiles that link to their sections', () => {
    render(<AdminDashboard links={LINKS} data={fixture()} />);
    const section = screen.getByRole('region', { name: '2 things need attention' });
    expect(within(section).getByText(/The latest health check is failing: gemini/)).toBeInTheDocument();
    const hrefs = within(section).getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['#status', '#errors', '#cost', '#households', '#status', '#errors']);
    expect(within(section).getByText('Failing')).toBeInTheDocument();
    expect(within(section).getByText('gemini failing')).toBeInTheDocument();
    expect(within(section).getByText('$1.00')).toBeInTheDocument();
    expect(within(section).getByText('of $5.00 daily cap')).toBeInTheDocument();
    expect(within(section).getByText('1 of 2')).toBeInTheDocument();
  });

  it('headline: "All systems OK" when nothing needs attention', () => {
    render(<AdminDashboard links={LINKS} data={fixture({ attention: { ok: true, data: [] } })} />);
    expect(screen.getByRole('region', { name: 'All systems OK' })).toBeInTheDocument();
  });

  it('headline: says so when the attention rules could not run', () => {
    render(<AdminDashboard links={LINKS} data={fixture({ attention: { ok: false, hint: 'is migration 022 applied?' } })} />);
    expect(screen.getByRole('region', { name: "Couldn't work out what needs attention" })).toBeInTheDocument();
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
    expect(strip.children).toHaveLength(3);
    expect(Array.from(strip.children).map((cell) => (cell as HTMLElement).style.flex)).toEqual(['300 1 0px', '2 1 0px', '298 1 0px']);
  });

  it('errors: a group per fingerprint with its detail', () => {
    render(<AdminDashboard links={LINKS} data={fixture()} />);
    const section = screen.getByRole('region', { name: 'Errors' });
    expect(within(section).getByText('coles-search: lookup failed', { selector: 'strong' })).toBeInTheDocument();
    expect(within(section).getByText('/api/coles-search')).toBeInTheDocument();
    expect(within(section).getByText('releases abc1234')).toBeInTheDocument();
    expect(within(section).getByText('2 households')).toBeInTheDocument();
    expect(within(section).getByText(/release abc1234 · route · status 429/)).toBeInTheDocument();
    expect(within(section).getByText(/4× · last/)).toBeInTheDocument();
  });

  it('AI agent, cost and quotas', () => {
    render(<AdminDashboard links={LINKS} data={fixture()} />);
    const ai = screen.getByRole('region', { name: 'AI agent' });
    expect(within(ai).getByText(/gemini-x · 20 calls · 90% worked · median 4000 ms · slowest 5% 9000 ms/)).toBeInTheDocument();
    expect(within(ai).getByText('error 2, http_503 ×2')).toBeInTheDocument();
    const cost = screen.getByRole('region', { name: 'Cost and quotas' });
    expect(within(cost).getByText('$1.00 of $5.00')).toBeInTheDocument();
    expect(within(cost).getByText('$17.00')).toBeInTheDocument();
    expect(within(cost).getByText('850 of 1000')).toBeInTheDocument();
  });

  it('households: short IDs only, each linking to a filtered view', () => {
    render(<AdminDashboard links={LINKS} data={fixture()} />);
    const section = screen.getByRole('region', { name: 'Households' });
    const link = within(section).getByRole('link', { name: 'Filter the page to household abcdef12' });
    expect(link).toHaveAttribute('href', '/admin?range=7d&household=abcdef12#households');
    expect(link).toHaveTextContent('abcdef12');
  });

  it('households: your own is marked You, and the rest are not', () => {
    render(<AdminDashboard links={LINKS} data={fixture()} />);
    const section = screen.getByRole('region', { name: 'Households' });
    expect(within(section).getAllByText('You')).toHaveLength(1);
    expect(within(section).getByText('You').closest('li')).toHaveTextContent('abcdef12');
  });

  it('a selected household is shown, with a way to clear the filter, and range links keep it', () => {
    render(<AdminDashboard links={LINKS} data={fixture({ household: 'abcdef12' })} />);
    expect(screen.getByText(/Household abcdef12/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'clear filter' })).toHaveAttribute('href', '/admin?range=7d');
    push.mockClear();
    fireEvent.click(screen.getByRole('tab', { name: '30 days' }));
    expect(push).toHaveBeenCalledWith('/admin?range=30d&household=abcdef12');
    expect(screen.getByRole('tab', { name: '7 days' })).toHaveAttribute('aria-selected', 'true');
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
    expect(within(section).getByText('Week of 16 Nov: of 2 households, 2 composed a plan, 2 confirmed it, 0 built a shopping list, 0 sent it to Coles and 1 finished shopping.')).toBeInTheDocument();
    expect(within(section).getByText('swap 5')).toBeInTheDocument();
  });

  it('weekly cycle: shows percentages once there are 10 or more plans in a week', () => {
    const data = fixture();
    if (!data.cycle.ok) throw new Error('fixture');
    data.cycle.data.weeks[0].composed = 20;
    data.cycle.data.events.funnel = [{ week_start: '2026-11-16', type: 'plan_confirmed', households: 10 }];
    render(<AdminDashboard links={LINKS} data={data} />);
    expect(within(screen.getByRole('region', { name: 'Weekly cycle and usage' })).getByText(/20 composed · 10 \(50%\) confirmed/)).toBeInTheDocument();
  });

  it('database: lists only the missing migrations, flags dead rows only on tables big enough to matter, and links out', () => {
    render(<AdminDashboard links={LINKS} data={fixture()} />);
    const section = screen.getByRole('region', { name: 'Database' });
    expect(within(section).getByText('Migrations 019 to 021: 021 is missing.')).toBeInTheDocument();
    expect(within(section).getByText('021 MISSING')).toBeInTheDocument();
    expect(within(section).queryByText('019 applied')).not.toBeInTheDocument();
    const flagged = within(section).getByText('High dead tuples');
    expect(flagged.closest('li')).toHaveTextContent('meal_plans');
    expect(within(section).queryAllByText('High dead tuples')).toHaveLength(1); // shopping_lists is 33% dead but has 2 rows
    expect(within(section).getByText('meal_plans have many dead rows and may need a vacuum.'.replace('have', 'has'))).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: 'Vercel project' })).toBeInTheDocument();
  });

  it('database: with every migration applied it says so in one line', () => {
    const data = fixture();
    if (!data.database.ok) throw new Error('fixture');
    data.database.data.schema = [{ migration: '019', name: 'app_errors', applied: true }, { migration: '020', name: 'product_events', applied: true }];
    render(<AdminDashboard links={LINKS} data={data} />);
    const section = screen.getByRole('region', { name: 'Database' });
    expect(within(section).getByText('Migrations 019 to 020: all 2 applied.')).toBeInTheDocument();
    expect(within(section).queryByText(/MISSING/)).not.toBeInTheDocument();
  });

  it('links to the existing debug pages', () => {
    render(<AdminDashboard links={LINKS} data={fixture()} />);
    const section = screen.getByRole('region', { name: 'Debug pages' });
    const hrefs = within(section).getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/debug/api-usage');
    expect(hrefs).toContain('/admin/debug');
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

  describe('hydration (React #418)', () => {
    afterEach(() => vi.unstubAllEnvs());

    // The page builds the links on the server and passes them in. In the browser
    // process.env has none of these values, so a section that read the env itself
    // would render different markup from the server's HTML and fail to hydrate.
    it('renders the same markup whatever the environment, because the links come in as a prop', () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abcd1234.supabase.co');
      vi.stubEnv('ADMIN_VERCEL_PROJECT_URL', 'https://vercel.com/team/app');
      const withEnv = render(<AdminDashboard links={LINKS} data={fixture()} />).container.innerHTML;
      cleanup();

      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
      vi.stubEnv('ADMIN_VERCEL_PROJECT_URL', '');
      const withoutEnv = render(<AdminDashboard links={LINKS} data={fixture()} />).container.innerHTML;

      expect(withoutEnv).toBe(withEnv);
      expect(withoutEnv).toContain('https://supabase.com/dashboard/project/abcd1234/sql/new');
    });
  });
});
