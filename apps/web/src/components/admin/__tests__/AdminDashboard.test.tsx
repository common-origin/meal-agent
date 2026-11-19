import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import AdminDashboard from '../AdminDashboard';
import type { DashboardData } from '@/lib/admin/queries';

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
      { shortId: 'abcdef12', members: 2, pending_invites: 1, last_active: '2026-11-18T11:00:00Z', has_plan_this_week: true, settings_complete: true, ai_calls: 12, ai_cost_usd: 0.2, errors: 1, last3_generation_failed: false },
      { shortId: '12345678', members: 1, pending_invites: 0, last_active: null, has_plan_this_week: false, settings_complete: false, ai_calls: 0, ai_cost_usd: 0, errors: 0, last3_generation_failed: false },
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
        { table: 'meal_plans', rows: 50, dead_rows: 30, dead_ratio: 0.375, size_bytes: 65536 },
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
    render(<AdminDashboard data={fixture()} />);
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Needs attention', 'Status', 'Errors', 'AI agent', 'Cost and quotas', 'Households', 'Weekly cycle and usage', 'Database', 'Debug pages']);
  });

  it('needs attention: each item links to its section', () => {
    render(<AdminDashboard data={fixture()} />);
    const section = screen.getByRole('region', { name: 'Needs attention' });
    expect(within(section).getByText(/The latest health check is failing: gemini/)).toBeInTheDocument();
    const links = within(section).getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(links).toEqual(['#status', '#errors']);
  });

  it('status: dependency states, uptime, no-data share, both releases and the last incident', () => {
    render(<AdminDashboard data={fixture()} />);
    const section = screen.getByRole('region', { name: 'Status' });
    expect(within(section).getByText('50.00%')).toBeInTheDocument();
    expect(within(section).getByText('50%')).toBeInTheDocument(); // no-data share
    expect(within(section).getByText('def5678')).toBeInTheDocument();
    expect(within(section).getByText(/Latest health row: abc1234 \(differs\)/)).toBeInTheDocument();
    expect(within(section).getByText('45 min')).toBeInTheDocument(); // the incident: 3 slots
    expect(within(section).getByText(/billing_errors_last_hour/)).toBeInTheDocument();
    expect(within(section).getByText(/Possible outages \(no heartbeat\)/)).toBeInTheDocument();
    expect(within(section).getByRole('img', { name: /1 ok, 1 failing, 2 no data, in 4 slots/ })).toBeInTheDocument();
  });

  it('errors: a group per fingerprint with its detail', () => {
    render(<AdminDashboard data={fixture()} />);
    const section = screen.getByRole('region', { name: 'Errors' });
    expect(within(section).getByText('coles-search: lookup failed', { selector: 'strong' })).toBeInTheDocument();
    expect(within(section).getByText('/api/coles-search')).toBeInTheDocument();
    expect(within(section).getByText('releases abc1234')).toBeInTheDocument();
    expect(within(section).getByText('2 households')).toBeInTheDocument();
    expect(within(section).getByText('status 429')).toBeInTheDocument();
  });

  it('AI agent, cost and quotas', () => {
    render(<AdminDashboard data={fixture()} />);
    const ai = screen.getByRole('region', { name: 'AI agent' });
    expect(within(ai).getByText('90%')).toBeInTheDocument();
    expect(within(ai).getByText('4000 ms')).toBeInTheDocument();
    expect(within(ai).getByText('http_503 ×2')).toBeInTheDocument();
    const cost = screen.getByRole('region', { name: 'Cost and quotas' });
    expect(within(cost).getByText('$1.00 of $5.00')).toBeInTheDocument();
    expect(within(cost).getByText('$17.00')).toBeInTheDocument();
    expect(within(cost).getByText('850 of 1000')).toBeInTheDocument();
  });

  it('households: short IDs only, each linking to a filtered view', () => {
    render(<AdminDashboard data={fixture()} />);
    const section = screen.getByRole('region', { name: 'Households' });
    const link = within(section).getByRole('link', { name: 'Filter the page to household abcdef12' });
    expect(link).toHaveAttribute('href', '/admin?range=7d&household=abcdef12#households');
    expect(link).toHaveTextContent('abcdef12');
  });

  it('a selected household is shown, with a way to clear the filter, and range links keep it', () => {
    render(<AdminDashboard data={fixture({ household: 'abcdef12' })} />);
    expect(screen.getByText(/Household abcdef12/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'clear filter' })).toHaveAttribute('href', '/admin?range=7d');
    expect(screen.getByRole('link', { name: '30d' })).toHaveAttribute('href', '/admin?range=30d&household=abcdef12');
    expect(screen.getByRole('link', { name: '7d' })).toHaveAttribute('aria-current', 'true');
  });

  it('weekly cycle: counts under 10 plans, percentages at 10 or more, and the pillar indicators', () => {
    render(<AdminDashboard data={fixture()} />);
    const section = screen.getByRole('region', { name: 'Weekly cycle and usage' });
    const row = within(section).getByRole('row', { name: /16 Nov/ });
    expect(row).toHaveTextContent('2'); // confirmed: a count, not "100%"
    expect(row).not.toHaveTextContent('%');
    expect(within(section).getByText('1.3')).toBeInTheDocument(); // (3 swaps + 1 edit) / 3 plans
    expect(within(section).getByText('7 AI / 1 imported / 1 user-added')).toBeInTheDocument();
    expect(within(section).getByText('3.5')).toBeInTheDocument();
    expect(within(section).getByText('swap 5')).toBeInTheDocument();
  });

  it('weekly cycle: shows percentages once there are 10 or more plans in a week', () => {
    const data = fixture();
    if (!data.cycle.ok) throw new Error('fixture');
    data.cycle.data.weeks[0].composed = 20;
    data.cycle.data.events.funnel = [{ week_start: '2026-11-16', type: 'plan_confirmed', households: 10 }];
    render(<AdminDashboard data={data} />);
    expect(within(screen.getByRole('region', { name: 'Weekly cycle and usage' })).getByText('10 (50%)')).toBeInTheDocument();
  });

  it('database: migration status, dead tuples flagged above 20%, and links out', () => {
    render(<AdminDashboard data={fixture()} />);
    const section = screen.getByRole('region', { name: 'Database' });
    expect(within(section).getByText('021 MISSING')).toBeInTheDocument();
    expect(within(section).getByText('019 applied')).toBeInTheDocument();
    const flagged = within(section).getByText('High dead tuples');
    expect(flagged.closest('tr')).toHaveTextContent('meal_plans');
    expect(within(section).queryAllByText('High dead tuples')).toHaveLength(1);
    expect(within(section).getByText('37.5%')).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: 'Vercel project' })).toBeInTheDocument();
  });

  it('links to the existing debug pages', () => {
    render(<AdminDashboard data={fixture()} />);
    const section = screen.getByRole('region', { name: 'Debug pages' });
    const hrefs = within(section).getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/debug/api-usage');
    expect(hrefs).toContain('/admin/debug');
  });

  it('a section that could not load says so with its migration hint, and the rest still render', () => {
    render(
      <AdminDashboard
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
    render(<AdminDashboard data={fixture({ attention: failed, status: failed, errors: failed, ai: failed, cost: failed, households: failed, cycle: failed, database: failed })} />);
    expect(screen.getAllByText(/Couldn't load/)).toHaveLength(8);
  });

  it('shows no email address or name anywhere on the page', () => {
    const { container } = render(<AdminDashboard data={fixture()} />);
    expect(container.textContent).not.toMatch(/@/);
  });
});
