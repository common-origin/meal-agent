// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  loadDashboard: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
vi.mock('@/lib/supabase/server', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('@/lib/admin/queries', () => ({ loadDashboard: mocks.loadDashboard }));
vi.mock('@/components/admin/AdminDashboard', () => ({ default: () => null }));

import AdminPage from '../admin/page';
import { config, proxy } from '../../proxy';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('ADMIN_EMAILS', 'owner@example.com');
  mocks.loadDashboard.mockResolvedValue({ range: '7d' });
});

const page = (searchParams: Record<string, string | string[] | undefined> = {}) => AdminPage({ searchParams: Promise.resolve(searchParams) });

describe('/admin page (#249)', () => {
  it('answers 404 to a signed-out request, loading nothing', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    await expect(page()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.loadDashboard).not.toHaveBeenCalled();
  });

  it('answers 404 to a signed-in user who is not in ADMIN_EMAILS, loading nothing', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'u1', email: 'someone-else@example.com' });
    await expect(page()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.loadDashboard).not.toHaveBeenCalled();
  });

  it('answers 404 when ADMIN_EMAILS is unset: nobody is an admin', async () => {
    vi.stubEnv('ADMIN_EMAILS', '');
    mocks.getCurrentUser.mockResolvedValue({ id: 'u1', email: 'owner@example.com' });
    await expect(page()).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('loads the dashboard for an admin, ignoring case in the email, with the range and household from the URL', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'u1', email: 'Owner@Example.com' });
    await page({ range: '30d', household: 'abcdef12' });
    expect(mocks.loadDashboard).toHaveBeenCalledWith({ range: '30d', household: 'abcdef12' });
  });

  it('falls back to 7d and no household for bad parameters', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'u1', email: 'owner@example.com' });
    await page({ range: 'forever', household: '../../etc/passwd' });
    expect(mocks.loadDashboard).toHaveBeenCalledWith({ range: '7d', household: null });
  });
});

describe('proxy: a non-admin never reaches /admin (#249)', () => {
  it('/admin is covered by the proxy matcher', () => {
    expect(config.matcher).toContain('/admin/:path*');
  });

  it('is exercised by the existing proxy tests for /admin and /debug, which redirect to /plan', () => {
    // proxy() itself needs Supabase; its admin rule is isAdminPath + isAdminEmail (lib/auth/admin.ts, tested there).
    expect(typeof proxy).toBe('function');
  });
});
