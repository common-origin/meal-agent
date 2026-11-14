import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DEFAULT_FAMILY_SETTINGS } from '@/lib/types/settings';
import type { FamilySettings } from '@/lib/types/settings';

const push = vi.fn();
let params = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => params,
}));

const saveFamilySettings = vi.fn<(settings: FamilySettings) => Promise<boolean>>(async () => true);
vi.mock('@/lib/hybridStorage', () => ({
  getFamilySettings: async () => DEFAULT_FAMILY_SETTINGS,
  saveFamilySettings: (settings: FamilySettings) => saveFamilySettings(settings),
  resetFamilySettings: async () => true,
}));

import SettingsPage from '../page';

beforeEach(() => {
  push.mockReset();
  saveFamilySettings.mockClear();
  params = new URLSearchParams();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({}), { status: 500 })));
  window.scrollTo = vi.fn();
});

describe('first-run setup: Settings with ?welcome=1 (#211)', () => {
  it('asks only what a first plan needs, then saves and goes to the plan', async () => {
    params = new URLSearchParams({ welcome: '1' });
    render(<SettingsPage />);

    expect(screen.getByText('Set up your household')).toBeInTheDocument();
    expect(screen.getByText('Cuisines')).toBeInTheDocument();
    expect(screen.queryByText('Batch cooking')).not.toBeInTheDocument();
    expect(screen.queryByText('Calendar Sync')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset to Defaults' })).not.toBeInTheDocument();

    // The neutral defaults have no city, so saving asks for one first.
    fireEvent.click(screen.getByRole('button', { name: 'Save and start planning' }));
    expect(await screen.findByText(/Enter your city/)).toBeInTheDocument();
    expect(saveFamilySettings).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText('e.g., Melbourne'), { target: { value: 'Brisbane' } });
    fireEvent.click(screen.getByText('Thai'));
    fireEvent.click(screen.getByRole('button', { name: 'Save and start planning' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/plan'));
    expect(saveFamilySettings.mock.calls[0][0]).toMatchObject({
      cuisines: ['thai'],
      location: { city: 'Brisbane' },
    });
  });

  it('is the full Settings page without it', async () => {
    render(<SettingsPage />);
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByText('Batch cooking')).toBeInTheDocument();
    expect(screen.getByText('Cuisines')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Settings' })).toBeInTheDocument();
  });
});
