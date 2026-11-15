import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PrivacyPage from '../privacy/page';
import TermsPage from '../terms/page';
import { config } from '../../proxy';
import { LEGAL_CONTACT_EMAIL } from '@/components/app/LegalPage';

describe('/privacy and /terms (#213)', () => {
  it('are public: the proxy never runs on them', () => {
    // Google's consent screen and people who haven't signed up must be able to read them.
    // Only plain paths and "/x/:path*" are understood here, so any other matcher syntax fails
    // the test rather than slipping a catch-all past it.
    const matches = (pattern: string, path: string) => {
      expect(pattern).toMatch(/^(\/[a-z-]+)+(\/:path\*)?$/);
      const base = pattern.replace(/\/:path\*$/, '');
      return path === base || path.startsWith(`${base}/`);
    };
    for (const path of ['/privacy', '/terms']) {
      expect(config.matcher.some((pattern) => matches(pattern, path))).toBe(false);
    }
  });

  it('privacy names what is stored, who processes it, and how to have it deleted', () => {
    render(<PrivacyPage />);
    expect(screen.getByRole('heading', { name: 'Privacy policy' })).toBeInTheDocument();
    for (const service of [/Supabase/, /Google Gemini/, /Resend/, /Vercel/]) {
      expect(screen.getAllByText(service).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(/allergies/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: LEGAL_CONTACT_EMAIL })[0]).toHaveAttribute('href', `mailto:${LEGAL_CONTACT_EMAIL}`);
  });

  it('terms say to check AI recipes for allergens and link the privacy policy', () => {
    render(<TermsPage />);
    expect(screen.getByRole('heading', { name: 'Check recipes for allergens' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'privacy policy' })).toHaveAttribute('href', '/privacy');
  });
});
